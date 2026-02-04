import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { getNow, defaultDateService } from '../services/DateService.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { generateVoteToken, validateVoteToken as decodeVoteToken } from '../utils/voteTokenUtils.js';
import { listUnits } from './unitsController.js';
import { getUnitEmailLanguage, getUnitRecipientInfo, isProduction, getDevEmailOverride } from '../utils/reportEmailUtils.js';

function toTimestamp(value, fallback = null) {
  if (!value) {
    return fallback;
  }
  if (value instanceof Date) {
    return admin.firestore.Timestamp.fromDate(value);
  }
  if (typeof value === 'string') {
    try {
      return defaultDateService.parseISOToTimestamp(value);
    } catch (error) {
      console.error('❌ Invalid ISO date string:', value, error);
      throw error;
    }
  }
  if (value.seconds !== undefined) {
    return new admin.firestore.Timestamp(value.seconds, value.nanoseconds || 0);
  }
  return fallback;
}

function formatDateField(value) {
  if (!value) {
    return null;
  }
  return defaultDateService.formatForFrontend(value);
}

async function getPollRef(db, clientId, pollId) {
  return db.doc(`clients/${clientId}/polls/${pollId}`);
}

async function fetchPoll(db, clientId, pollId) {
  const pollRef = await getPollRef(db, clientId, pollId);
  const snapshot = await pollRef.get();
  if (!snapshot.exists) {
    return null;
  }
  return {
    ref: pollRef,
    data: snapshot.data(),
    id: snapshot.id,
  };
}

function serializePoll(doc) {
  if (!doc) return null;
  const data = typeof doc.data === 'function' ? doc.data() : doc.data;
  if (!data) return null;
  const metadata = data.metadata || {};
  return {
    pollId: doc.id,
    ...data,
    closesAt: formatDateField(data.closesAt),
    publishedAt: formatDateField(data.publishedAt),
    closedAt: formatDateField(data.closedAt),
    metadata: {
      ...metadata,
      createdAt: formatDateField(metadata.createdAt),
      updatedAt: formatDateField(metadata.updatedAt),
    },
    results: data.results || null,
  };
}

function normalizeResponsePayload(poll, response) {
  if (!response) {
    return [];
  }
  const availableOptions = new Set((poll.options || []).map((opt) => opt.id));
  return (response.selectedOptions || []).filter((optionId) => availableOptions.has(optionId));
}

function calculateResults(poll, responses, totalUnits) {
  const pollOptions = poll.options || [];
  const results = pollOptions.map((option) => ({
    optionId: option.id,
    label: option.label,
    label_es: option.label_es,
    count: 0,
    percentage: 0,
    weightedCount: 0,
    weightedPercentage: 0,
  }));

  const abstentions = responses.filter((response) => response.abstained);
  const votes = responses.filter((response) => !response.abstained && (response.selectedOptions || []).length > 0);
  const totalResponses = votes.length + abstentions.length;
  const eligibleUnits = totalUnits || poll.totalEligibleUnits || poll.totalUnits || 0;
  const participationPercent = eligibleUnits > 0 ? (totalResponses / eligibleUnits) * 100 : 0;

  let totalVotes = 0;
  let totalWeight = 0;

  votes.forEach((response) => {
    totalVotes += 1;
    const ownership = Number(response.ownershipPercentage || 0);
    totalWeight += ownership;
    const selectedOptions = normalizeResponsePayload(poll, response);

    selectedOptions.forEach((optionId) => {
      const optionResult = results.find((item) => item.optionId === optionId);
      if (optionResult) {
        optionResult.count += 1;
        optionResult.weightedCount += ownership;
      }
    });
  });

  results.forEach((optionResult) => {
    optionResult.percentage = totalVotes > 0 ? (optionResult.count / totalVotes) * 100 : 0;
    optionResult.weightedPercentage = totalWeight > 0 ? (optionResult.weightedCount / totalWeight) * 100 : 0;
  });

  let outcome = null;
  const quorumPercentage = poll.quorumPercentage || 0;
  const quorumMet = poll.quorumType === 'none' ? true : participationPercent >= quorumPercentage;
  const useWeighted = poll.useWeightedVoting !== undefined ? poll.useWeightedVoting : poll.type === 'vote';

  if (quorumMet && totalVotes > 0) {
    const winningOption = results.reduce((max, current) => {
      const maxValue = useWeighted ? max.weightedPercentage : max.percentage;
      const currentValue = useWeighted ? current.weightedPercentage : current.percentage;
      return currentValue > maxValue ? current : max;
    });

    if (['approve_deny', 'yes_no'].includes(poll.responseType)) {
      const approveOption = results.find((item) => item.optionId === 'approve' || item.optionId === 'yes');
      if (approveOption) {
        const approvePercent = useWeighted ? approveOption.weightedPercentage : approveOption.percentage;
        const requiredPercent = poll.quorumType === 'supermajority' ? 67 : poll.quorumPercentage || 51;
        outcome = approvePercent >= requiredPercent ? 'approved' : 'denied';
      }
    } else {
      outcome = winningOption?.optionId || null;
    }
  }

  return {
    totalUnits: eligibleUnits,
    totalResponses,
    votes: votes.length,
    abstentions: abstentions.length,
    nonResponses: eligibleUnits > 0 ? Math.max(eligibleUnits - totalResponses, 0) : 0,
    quorumMet,
    outcome,
    breakdown: results,
    participationPercent,
  };
}

function serializeResponse(doc) {
  const data = doc.data();
  return {
    unitId: doc.id,
    ...data,
    submittedAt: formatDateField(data.submittedAt),
    modifiedAt: formatDateField(data.modifiedAt),
  };
}

const OPTION_BASED_RESPONSE_TYPES = ['single_choice', 'multiple_choice', 'approve_deny', 'yes_no'];

function getResponseValidationErrors(poll, response, allowChange) {
  const errors = [];

  if (!response) {
    errors.push('Response body is required');
    return errors;
  }

  const options = new Set((poll.options || []).map((opt) => opt.id));
  const selectedOptions = response.selectedOptions || [];
  const abstained = Boolean(response.abstained);
  const hasComment = Boolean((response.comment || '').trim());
  const isOptionBased = OPTION_BASED_RESPONSE_TYPES.includes(poll.responseType);

  // For option-based polls: require at least one option selected or abstain.
  // For free_text (and other non-option types): require abstain or some content (e.g. comment).
  if (isOptionBased) {
    if (!abstained && selectedOptions.length === 0) {
      errors.push('At least one option must be selected or abstained must be true');
    }
    if (selectedOptions.some((optionId) => !options.has(optionId))) {
      errors.push('Selected options contain invalid values');
    }
    if (poll.responseType === 'single_choice' && selectedOptions.length > 1) {
      errors.push('Only one option can be selected for single-choice polls');
    }
  } else {
    // free_text or other types without fixed options
    if (!abstained && !hasComment) {
      errors.push('Either abstain or provide a response (e.g. comment/text).');
    }
  }

  if (!poll.allowChangeVote && !allowChange) {
    errors.push('Changes to this vote are not allowed');
  }

  return errors;
}

export async function listPollsHandler(req, res) {
  try {
    const { clientId } = req.params;
    const { status } = req.query;
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/polls`).get();
    const polls = snapshot.docs
      .map((doc) => serializePoll(doc))
      .filter((poll) => !status || poll.status === status)
      .sort((a, b) => {
        const aTime = a.closesAt ? Date.parse(a.closesAt) : 0;
        const bTime = b.closesAt ? Date.parse(b.closesAt) : 0;
        return bTime - aTime;
      });

    res.json({
      success: true,
      count: polls.length,
      data: polls,
    });
  } catch (error) {
    console.error('❌ Error listing polls:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPollHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    const responsesSnapshot = await pollDoc.ref.collection('responses').get();
    const responses = responsesSnapshot.docs.map((doc) => doc.data());
    const unitsSnapshot = await db.collection(`clients/${clientId}/units`).get();

    const results = calculateResults(
      pollDoc.data,
      responses,
      unitsSnapshot.size
    );

    res.json({
      success: true,
      data: {
        ...serializePoll(pollDoc),
        summary: results,
      },
    });
  } catch (error) {
    console.error('❌ Error getting poll:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createPollHandler(req, res) {
  try {
    const { clientId } = req.params;
    const pollPayload = req.body || {};
    const db = await getDb();

    if (!pollPayload.title || !pollPayload.title_es) {
      return res.status(400).json({ success: false, error: 'Title (both languages) is required' });
    }

    if (!pollPayload.responseType) {
      return res.status(400).json({ success: false, error: 'Response type is required' });
    }

    if (!pollPayload.closesAt) {
      return res.status(400).json({ success: false, error: 'Close date is required' });
    }

    const optionsRequired = ['single_choice', 'multiple_choice', 'approve_deny', 'yes_no'];
    if (optionsRequired.includes(pollPayload.responseType) && (!Array.isArray(pollPayload.options) || pollPayload.options.length === 0)) {
      return res.status(400).json({ success: false, error: 'At least one option is required' });
    }

    const now = getNow();
    const closesAtTimestamp = toTimestamp(pollPayload.closesAt);

    const pollDoc = {
      type: pollPayload.type || 'poll',
      category: pollPayload.category || 'other',
      title: pollPayload.title,
      title_es: pollPayload.title_es,
      description: pollPayload.description || '',
      description_es: pollPayload.description_es || '',
      responseType: pollPayload.responseType,
      options: pollPayload.options || [],
      allowComment: Boolean(pollPayload.allowComment),
      showOtherVotes: Boolean(pollPayload.showOtherVotes),
      allowChangeVote: pollPayload.allowChangeVote !== undefined ? Boolean(pollPayload.allowChangeVote) : true,
      projectId: pollPayload.projectId || null,
      fiscalYear: pollPayload.fiscalYear || null,
      documentId: pollPayload.documentId || null,
      closesAt: closesAtTimestamp,
      status: 'draft',
      quorumType: pollPayload.quorumType || (pollPayload.type === 'vote' ? 'simple_majority' : 'none'),
      quorumPercentage: pollPayload.quorumPercentage || (pollPayload.type === 'vote' ? 51 : null),
      useWeightedVoting: pollPayload.useWeightedVoting !== undefined ? Boolean(pollPayload.useWeightedVoting) : pollPayload.type === 'vote',
      publishedAt: null,
      closedAt: null,
      results: null,
      metadata: {
        createdAt: admin.firestore.Timestamp.fromDate(now),
        createdBy: req.user?.email || 'system',
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        updatedBy: req.user?.email || 'system',
        notes: pollPayload.metadata?.notes || '',
      },
      documents: pollPayload.documents || [],
    };

    const pollCollection = db.collection(`clients/${clientId}/polls`);
    const pollRef = pollPayload.pollId
      ? pollCollection.doc(pollPayload.pollId)
      : pollCollection.doc();

    await pollRef.set(pollDoc);

    await writeAuditLog({
      module: 'polls',
      action: 'create',
      parentPath: `clients/${clientId}/polls`,
      docId: pollRef.id,
      friendlyName: pollDoc.title,
      notes: `Poll created with status ${pollDoc.status}`,
      clientId,
    });

    res.status(201).json({
      success: true,
      data: {
        pollId: pollRef.id,
        ...pollDoc,
        closesAt: formatDateField(closesAtTimestamp),
      },
    });
  } catch (error) {
    console.error('❌ Error creating poll:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updatePollHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const updates = req.body || {};
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    const pollData = pollDoc.data;
    const status = pollData.status || 'draft';

    if (['closed', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Closed or archived polls cannot be updated' });
    }

    if (status === 'open') {
      const allowedFields = new Set([
        'description',
        'description_es',
        'allowComment',
        'showOtherVotes',
        'allowChangeVote',
        'closesAt',
        'documents',
        'metadata',
      ]);

      const invalidFields = Object.keys(updates).filter((field) => !allowedFields.has(field));
      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot update fields while poll is open: ${invalidFields.join(', ')}`,
        });
      }
    }

    const now = getNow();
    const updatePayload = { ...updates };

    if (updatePayload.closesAt) {
      updatePayload.closesAt = toTimestamp(updatePayload.closesAt, pollData.closesAt);
    }

    updatePayload.metadata = {
      ...(pollData.metadata || {}),
      ...(updatePayload.metadata || {}),
      updatedAt: admin.firestore.Timestamp.fromDate(now),
      updatedBy: req.user?.email || 'system',
    };

    await pollDoc.ref.update(updatePayload);

    await writeAuditLog({
      module: 'polls',
      action: 'update',
      parentPath: `clients/${clientId}/polls/${pollId}`,
      docId: pollId,
      friendlyName: pollData.title,
      notes: `Poll updated (status: ${pollData.status})`,
      clientId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating poll:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deletePollHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    if (pollDoc.data.type !== 'poll') {
      return res.status(400).json({ success: false, error: 'Only non-binding polls can be deleted' });
    }

    if (pollDoc.data.status !== 'closed' && pollDoc.data.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Poll must be closed or draft before deletion' });
    }

    // Cascade delete: Firestore does NOT auto-delete subcollections when a document is deleted
    // (no "recursive" or "cascade" parameter on doc.ref.delete()). We autodiscover subcollections
    // via listCollections() so any new collections under the poll doc are deleted without code changes.
    // If you add nested subcollections (e.g. subcollections of responses), extend this to recurse
    // or use firebase-tools firestore.delete(path, { recursive: true }) — see
    // https://firebase.google.com/docs/firestore/solutions/delete-collections
    const BATCH_SIZE = 500;
    const subcollections = await pollDoc.ref.listCollections();
    const allDeletes = [];
    for (const collRef of subcollections) {
      const snap = await collRef.get();
      snap.docs.forEach((d) => allDeletes.push(d));
    }
    for (let i = 0; i < allDeletes.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = allDeletes.slice(i, i + BATCH_SIZE);
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    await pollDoc.ref.delete();

    await writeAuditLog({
      module: 'polls',
      action: 'delete',
      parentPath: `clients/${clientId}/polls`,
      docId: pollId,
      friendlyName: pollDoc.data.title,
      notes: 'Poll deleted',
      clientId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting poll:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function publishPollHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    if (pollDoc.data.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Only draft polls can be published' });
    }

    const closesAt = pollDoc.data.closesAt;
    if (!closesAt) {
      return res.status(400).json({ success: false, error: 'Poll must have a close date before publishing' });
    }

    const now = getNow();

    await pollDoc.ref.update({
      status: 'open',
      publishedAt: admin.firestore.Timestamp.fromDate(now),
      metadata: {
        ...(pollDoc.data.metadata || {}),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        updatedBy: req.user?.email || 'system',
      },
    });

    const tokens = await generateVoteTokensInternal(clientId, pollId, req.user?.email || 'system');

    res.json({ success: true, tokens });
  } catch (error) {
    console.error('❌ Error publishing poll:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function closePollHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    if (pollDoc.data.status !== 'open') {
      return res.status(400).json({ success: false, error: 'Only open polls can be closed' });
    }

    const responsesSnapshot = await pollDoc.ref.collection('responses').get();
    const responses = responsesSnapshot.docs.map((doc) => doc.data());
    const unitsSnapshot = await db.collection(`clients/${clientId}/units`).get();

    const results = calculateResults(
      pollDoc.data,
      responses,
      unitsSnapshot.size
    );

    const now = getNow();
    await pollDoc.ref.update({
      status: 'closed',
      closedAt: admin.firestore.Timestamp.fromDate(now),
      results,
      metadata: {
        ...(pollDoc.data.metadata || {}),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        updatedBy: req.user?.email || 'system',
      },
    });

    await writeAuditLog({
      module: 'polls',
      action: 'close',
      parentPath: `clients/${clientId}/polls/${pollId}`,
      docId: pollId,
      friendlyName: pollDoc.data.title,
      notes: `Poll closed with outcome ${results.outcome || 'undetermined'}`,
      clientId,
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('❌ Error closing poll:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function archivePollHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    if (pollDoc.data.status !== 'closed') {
      return res.status(400).json({ success: false, error: 'Only closed polls can be archived' });
    }

    const now = getNow();
    await pollDoc.ref.update({
      status: 'archived',
      metadata: {
        ...(pollDoc.data.metadata || {}),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        updatedBy: req.user?.email || 'system',
      },
    });

    await writeAuditLog({
      module: 'polls',
      action: 'archive',
      parentPath: `clients/${clientId}/polls/${pollId}`,
      docId: pollId,
      friendlyName: pollDoc.data.title,
      notes: 'Poll archived',
      clientId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error archiving poll:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function recordResponseHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const { unitId } = req.body || {};
    if (!unitId) {
      return res.status(400).json({ success: false, error: 'unitId is required' });
    }

    const response = req.body || {};
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    if (pollDoc.data.status !== 'open') {
      return res.status(400).json({ success: false, error: 'Responses can only be recorded for open polls' });
    }

    const responseRef = pollDoc.ref.collection('responses').doc(unitId);
    const existingResponseSnapshot = await responseRef.get();
    const existingResponse = existingResponseSnapshot.exists ? existingResponseSnapshot.data() : null;
    const allowChange = existingResponse ? pollDoc.data.allowChangeVote : true;
    const validationErrors = getResponseValidationErrors(pollDoc.data, response, allowChange);

    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, error: validationErrors.join('; ') });
    }

    const unitDoc = await db.doc(`clients/${clientId}/units/${unitId}`).get();
    if (!unitDoc.exists) {
      return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    const now = getNow();
    const ownershipPercentage = unitDoc.data()?.ownershipPercentage || 0;
    const submittedBy = req.user?.email || 'admin';
    const responsePayload = {
      selectedOptions: response.selectedOptions || [],
      comment: response.comment || '',
      abstained: Boolean(response.abstained),
      ownershipPercentage,
      submittedAt: admin.firestore.Timestamp.fromDate(now),
      submittedBy,
      submittedVia: 'admin_entry',
      source: response.source || 'admin',
      isProxy: Boolean(response.isProxy),
      proxyFor: response.proxyFor || null,
      proxyAuthorizedBy: response.proxyAuthorizedBy || null,
      modifiedAt: existingResponse ? admin.firestore.Timestamp.fromDate(now) : null,
      modifiedBy: existingResponse ? submittedBy : null,
    };

    await responseRef.set(responsePayload, { merge: true });

    await writeAuditLog({
      module: 'polls',
      action: 'record_response',
      parentPath: `clients/${clientId}/polls/${pollId}/responses`,
      docId: unitId,
      friendlyName: pollDoc.data.title,
      notes: `Response recorded by ${submittedBy}`,
      clientId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error recording poll response:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getResponsesHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    const responsesSnapshot = await pollDoc.ref.collection('responses').get();
    const responses = responsesSnapshot.docs.map((doc) => serializeResponse(doc));

    res.json({
      success: true,
      data: responses,
      count: responses.length,
    });
  } catch (error) {
    console.error('❌ Error fetching poll responses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function generateVoteTokensInternal(clientId, pollId, actor = 'system') {
  const db = await getDb();
  const pollDoc = await fetchPoll(db, clientId, pollId);
  if (!pollDoc) {
    throw new Error('Poll not found');
  }

  const pollData = pollDoc.data;
  const closesAt = pollData.closesAt;
  if (!closesAt) {
    throw new Error('Poll does not have a close date');
  }

  const unitsArray = await listUnits(clientId);
  const unitsMap = new Map(unitsArray.map((u) => [u.unitId, u]));
  const expiresAt = closesAt.toDate ? closesAt.toDate() : new Date(closesAt);
  const tokens = [];

  const batch = db.batch();
  const tokensCollection = pollDoc.ref.collection('tokens');

  unitsMap.forEach((unitData, unitId) => {
    const token = generateVoteToken(clientId, pollId, unitId, expiresAt);
    const tokenDocRef = tokensCollection.doc(unitId);
    batch.set(tokenDocRef, {
      token,
      unitId,
      createdAt: admin.firestore.Timestamp.fromDate(getNow()),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      email: (unitData.owners || [])[0]?.email || null,
      sent: false,
    });
    tokens.push({
      unitId,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  });

  await batch.commit();

  await pollDoc.ref.update({
    totalEligibleUnits: unitsMap.size,
    tokensGeneratedAt: admin.firestore.Timestamp.fromDate(getNow()),
  });

  await writeAuditLog({
    module: 'polls',
    action: 'generate_tokens',
    parentPath: `clients/${clientId}/polls/${pollId}`,
    docId: pollId,
    friendlyName: pollData.title,
    notes: `Generated ${tokens.length} vote tokens`,
    clientId,
  });

  return tokens;
}

export async function generateVoteTokensHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const tokens = await generateVoteTokensInternal(clientId, pollId, req.user?.email || 'system');
    res.json({ success: true, tokens });
  } catch (error) {
    console.error('❌ Error generating vote tokens:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function validateVoteTokenHandler(req, res) {
  try {
    const { token } = req.params;
    const validation = decodeVoteToken(token);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const { clientId, pollId, unitId } = validation.payload;
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    const unitDoc = await db.doc(`clients/${clientId}/units/${unitId}`).get();
    if (!unitDoc.exists) {
      return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    const responseDoc = await pollDoc.ref.collection('responses').doc(unitId).get();
    const response = responseDoc.exists ? serializeResponse(responseDoc) : null;
    
    const pollStatus = pollDoc.data.status;
    const isClosed = pollStatus === 'closed' || pollStatus === 'archived';
    
    // If poll is closed and user hasn't voted, show appropriate message
    if (isClosed && !response) {
      return res.status(400).json({ 
        success: false, 
        error: 'This poll is closed. Voting is no longer available.' 
      });
    }
    
    // If poll is closed and user has voted, allow viewing (for confirmation/results)
    // If poll is open, allow voting
    const canVote = pollStatus === 'open';

    const clientDoc = await db.collection('clients').doc(clientId).get();
    const clientData = clientDoc.exists ? clientDoc.data() : {};
    const clientName = clientData.basicInfo?.fullName || clientData.basicInfo?.displayName || clientData.summary?.fullName || clientData.fullName || clientData.name || clientId;
    const clientLogoUrl = clientData.branding?.logoUrl || clientData.summary?.logoUrl || clientData.logoUrl || null;

    // If showOtherVotes is enabled and user has voted, include summary results
    // This serves as a confirmation that their vote was recorded
    let summary = null;
    if (pollDoc.data.showOtherVotes && response) {
      // Get all responses to build summary
      const responsesSnapshot = await pollDoc.ref.collection('responses').get();
      const responses = responsesSnapshot.docs.map(doc => doc.data());
      
      // Calculate vote counts
      const optionCounts = {};
      (pollDoc.data.options || []).forEach(opt => {
        optionCounts[opt.id] = { 
          label: opt.label, 
          count: 0, 
          percentage: 0 
        };
      });
      optionCounts['abstain'] = { label: 'Abstain', count: 0, percentage: 0 };
      
      let totalResponses = 0;
      responses.forEach(resp => {
        if (resp.abstained) {
          optionCounts['abstain'].count++;
          totalResponses++;
        } else if (resp.selectedOptions?.length > 0) {
          resp.selectedOptions.forEach(optId => {
            if (optionCounts[optId]) {
              optionCounts[optId].count++;
            }
          });
          totalResponses++;
        }
      });
      
      // Calculate percentages
      Object.keys(optionCounts).forEach(key => {
        if (totalResponses > 0) {
          optionCounts[key].percentage = (optionCounts[key].count / totalResponses) * 100;
        }
      });
      
      summary = {
        totalResponses,
        results: Object.entries(optionCounts).map(([id, data]) => ({
          optionId: id,
          label: data.label,
          count: data.count,
          percentage: data.percentage
        }))
      };
    }

    res.json({
      success: true,
      data: {
        client: {
          clientId,
          name: clientName,
          logoUrl: clientLogoUrl && String(clientLogoUrl).trim() ? clientLogoUrl : null,
        },
        poll: {
          pollId,
          clientId,
          title: pollDoc.data.title,
          title_es: pollDoc.data.title_es,
          description: pollDoc.data.description,
          description_es: pollDoc.data.description_es,
          responseType: pollDoc.data.responseType,
          options: pollDoc.data.options,
          allowComment: pollDoc.data.allowComment,
          allowChangeVote: pollDoc.data.allowChangeVote,
          showOtherVotes: pollDoc.data.showOtherVotes,
          status: pollStatus,
          closesAt: formatDateField(pollDoc.data.closesAt),
        },
        unit: {
          unitId,
          ownershipPercentage: unitDoc.data().ownershipPercentage || 0,
          unitName: unitDoc.data().unitName || unitId,
        },
        response,
        summary,  // Include when showOtherVotes is true and poll is closed
        canVote,  // Indicates if voting is still allowed
      },
    });
  } catch (error) {
    console.error('❌ Error validating vote token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function submitVoteViaTokenHandler(req, res) {
  try {
    const { token } = req.params;
    const validation = decodeVoteToken(token);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const { clientId, pollId, unitId } = validation.payload;
    const db = await getDb();
    const pollDoc = await fetchPoll(db, clientId, pollId);

    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    if (pollDoc.data.status !== 'open') {
      return res.status(400).json({ success: false, error: 'Poll is not currently accepting votes' });
    }

    const responseBody = req.body || {};
    const responseRef = pollDoc.ref.collection('responses').doc(unitId);
    const existingSnapshot = await responseRef.get();
    const existingResponse = existingSnapshot.exists ? existingSnapshot.data() : null;
    // allowChange: true if no existing response (new vote) OR if poll allows changes
    const allowChange = !existingResponse || pollDoc.data.allowChangeVote;
    const validationErrors = getResponseValidationErrors(
      pollDoc.data,
      responseBody,
      allowChange
    );

    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, error: validationErrors.join('; ') });
    }

    const unitDoc = await db.doc(`clients/${clientId}/units/${unitId}`).get();
    if (!unitDoc.exists) {
      return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    const now = getNow();
    const ownershipPercentage = unitDoc.data()?.ownershipPercentage || 0;

    const responsePayload = {
      selectedOptions: responseBody.selectedOptions || [],
      comment: responseBody.comment || '',
      abstained: Boolean(responseBody.abstained),
      ownershipPercentage,
      submittedAt: admin.firestore.Timestamp.fromDate(now),
      submittedBy: responseBody.email || 'email_link',
      submittedVia: 'email_link',
      source: 'email_link',
      modifiedAt: existingResponse ? admin.firestore.Timestamp.fromDate(now) : null,
      modifiedBy: existingResponse ? (responseBody.email || 'email_link') : null,
    };

    await responseRef.set(responsePayload, { merge: true });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error submitting vote via token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Send poll notifications to all units with tokens
 * POST /api/vote/clients/:clientId/polls/:pollId/send-notifications
 */
export async function sendPollNotificationsHandler(req, res) {
  try {
    const { clientId, pollId } = req.params;
    const { language = 'both' } = req.body; // 'english', 'spanish', or 'both'
    const db = await getDb();

    const pollDoc = await fetchPoll(db, clientId, pollId);
    if (!pollDoc) {
      return res.status(404).json({ success: false, error: 'Poll not found' });
    }

    if (pollDoc.data.status !== 'open') {
      return res.status(400).json({ success: false, error: 'Notifications can only be sent for open polls' });
    }

    // Get client info for email branding
    const clientDoc = await db.doc(`clients/${clientId}`).get();
    const clientData = clientDoc.exists ? clientDoc.data() : {};
    const clientName = clientData.basicInfo?.fullName || clientData.basicInfo?.displayName || clientData.name || 'Your HOA';
    const clientLogoUrl = clientData.branding?.logoUrl || null;

    // Get all responses to know which units have voted
    const responsesSnapshot = await pollDoc.ref.collection('responses').get();
    const votedUnitIds = new Set(responsesSnapshot.docs.map(doc => doc.data().unitId));
    console.log(`📊 Units that have voted: ${votedUnitIds.size}`);

    // Get all tokens (we'll filter by: not voted, or not sent yet)
    const allTokensSnapshot = await pollDoc.ref.collection('tokens').get();
    
    // Filter to tokens for units that haven't voted yet
    const eligibleTokens = allTokensSnapshot.docs.filter(doc => {
      const tokenData = doc.data();
      return !votedUnitIds.has(tokenData.unitId);
    });
    
    if (eligibleTokens.length === 0) {
      return res.json({
        success: true,
        sent: 0,
        failed: 0,
        skippedVoted: votedUnitIds.size,
        message: 'All units have already voted'
      });
    }
    
    console.log(`📧 Sending to ${eligibleTokens.length} units (${votedUnitIds.size} already voted, skipped)`);

    // Import email utilities
    const nodemailer = (await import('nodemailer')).default;
    const { generatePollNotificationHtml, generatePollNotificationText } = await import('../templates/pollNotificationTemplate.js');

    // Create email transporter
    const gmailUser = process.env.GMAIL_USER || 'michael@landesman.com';
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    
    if (!gmailPass) {
      return res.status(500).json({ success: false, error: 'Email configuration missing (GMAIL_APP_PASSWORD)' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });

    // Format close date
    const closesAt = pollDoc.data.closesAt
      ? formatDateField(pollDoc.data.closesAt)?.display || formatDateField(pollDoc.data.closesAt)?.ISO_8601 || 'TBD'
      : 'TBD';

    // Prepare documents list
    const documents = (pollDoc.data.documents || []).map(doc => ({
      name: doc.name || doc.filename || 'Document',
      url: doc.url || doc.downloadURL
    })).filter(doc => doc.url);

    // Base voting URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    let sent = 0;
    let failed = 0;
    const errors = [];
    const voteLinks = []; // Collect for summary output

    // Dev mode: redirect all emails to developer for testing (same pattern as Statement emails)
    const IS_PRODUCTION = isProduction();
    const devEmailOverride = getDevEmailOverride();
    
    if (!IS_PRODUCTION) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔧 DEV MODE: All emails will be sent to:', devEmailOverride);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Process each eligible token (units that haven't voted)
    for (const tokenDoc of eligibleTokens) {
      const tokenData = tokenDoc.data();
      const originalEmail = tokenData.email;
      const unitId = tokenData.unitId;
      const token = tokenData.token;

      if (!originalEmail) {
        console.log(`⚠️ Skipping unit ${unitId} - no email address`);
        continue;
      }

      const voteUrl = `${frontendUrl}/vote/${token}`;
      
      // Look up unit data for owner name and language preference
      let ownerName = 'Owner';
      let emailLanguage = language === 'both' ? 'english' : language;
      
      try {
        const unitDoc = await db.collection('clients').doc(clientId)
          .collection('units').doc(unitId).get();
        
        if (unitDoc.exists) {
          const unitData = unitDoc.data();
          const recipientInfo = await getUnitRecipientInfo(unitData, clientId);
          ownerName = recipientInfo.ownerNames || 'Owner';
          // Use owner's language preference if not specified in request
          if (language === 'both' || !language) {
            emailLanguage = recipientInfo.language;
          }
        }
      } catch (unitErr) {
        console.warn(`⚠️ Could not look up unit ${unitId} for personalization:`, unitErr.message);
      }
      
      // In dev mode, redirect to developer email (same pattern as Statement emails)
      const email = IS_PRODUCTION ? originalEmail : devEmailOverride;

      // Collect vote link for summary
      voteLinks.push({ unitId, voteUrl, originalEmail, ownerName, language: emailLanguage, redirectedTo: IS_PRODUCTION ? null : devEmailOverride });

      try {
        const htmlContent = generatePollNotificationHtml({
          clientName,
          clientLogoUrl,
          ownerName,
          pollTitle: pollDoc.data.title,
          pollDescription: pollDoc.data.description,
          pollType: pollDoc.data.type || 'poll',
          closesAt,
          voteUrl,
          unitId,
          documents,
          language: emailLanguage
        });

        const textContent = generatePollNotificationText({
          clientName,
          ownerName,
          pollTitle: pollDoc.data.title,
          pollDescription: pollDoc.data.description,
          pollType: pollDoc.data.type || 'poll',
          closesAt,
          voteUrl,
          unitId,
          documents,
          language: emailLanguage
        });

        const subject = emailLanguage === 'spanish'
          ? `${clientName}: ${pollDoc.data.title_es || pollDoc.data.title}`
          : `${clientName}: ${pollDoc.data.title}`;

        await transporter.sendMail({
          from: `"${clientName}" <michael@sandyland.com.mx>`,
          to: email,
          replyTo: 'pm@sandyland.com.mx',
          subject,
          text: textContent,
          html: htmlContent
        });

        // Update token as sent
        await tokenDoc.ref.update({
          sent: true,
          emailSentAt: admin.firestore.Timestamp.fromDate(getNow()),
          emailError: null
        });

        sent++;
        console.log(`✅ Sent notification to ${email} for unit ${unitId}`);

      } catch (emailError) {
        failed++;
        errors.push({ unitId, email, error: emailError.message });
        console.error(`❌ Failed to send to ${email}:`, emailError.message);

        // Update token with error
        await tokenDoc.ref.update({
          emailError: emailError.message
        });
      }
    }

    const skippedVoted = votedUnitIds.size;
    
    await writeAuditLog({
      module: 'polls',
      action: 'send_notifications',
      parentPath: `clients/${clientId}/polls/${pollId}`,
      docId: pollId,
      friendlyName: pollDoc.data.title,
      notes: `Sent ${sent} notifications, ${failed} failed, ${skippedVoted} already voted (skipped)`,
      clientId,
    });

    // Print summary of all vote links for easy testing
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 VOTE LINKS SUMMARY (copy for testing):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const link of voteLinks) {
      console.log(`Unit ${link.unitId}: ${link.voteUrl}`);
      if (!IS_PRODUCTION) {
        console.log(`   📧 Original: ${link.originalEmail} → Sent to: ${link.redirectedTo}`);
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Sent: ${sent} | ❌ Failed: ${failed} | ⏭️ Skipped (already voted): ${skippedVoted}`);
    if (!IS_PRODUCTION) {
      console.log(`🔧 DEV MODE: All emails redirected to ${devEmailOverride}`);
      console.log(`   (Production would send to actual unit owner emails)`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.json({
      success: true,
      sent,
      failed,
      skippedVoted,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Error sending poll notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
