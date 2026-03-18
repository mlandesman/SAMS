/**
 * usePollsProjects — Fetch active polls and projects for a client.
 *
 * Returns both full arrays (for HOADashboard list rendering) and
 * counts (for OwnerDashboard3Cards summary line).
 */
import { useState, useEffect } from 'react';
import { config } from '../config/index.js';
import { auth } from '../services/firebase';

export function usePollsProjects(clientId) {
  const [polls, setPolls] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setPolls([]);
      setProjects([]);
      setLoading(false);
      return;
    }

    const user = auth.currentUser;
    const tokenPromise = user?.getIdToken?.();
    if (!tokenPromise) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    tokenPromise.then((t) => {
      if (cancelled) return;
      const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
      return Promise.all([
        fetch(`${config.api.baseUrl}/vote/clients/${clientId}/polls`, { headers }),
        fetch(`${config.api.baseUrl}/clients/${clientId}/projects`, { headers }),
      ]);
    }).then(async ([pollsRes, projectsRes]) => {
      if (cancelled) return;
      const [pollsJson, projectsJson] = await Promise.all([
        pollsRes?.ok ? pollsRes.json().catch(() => null) : Promise.resolve(null),
        projectsRes?.ok ? projectsRes.json().catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (pollsJson) {
        const list = pollsJson?.data || pollsJson?.polls || pollsJson || [];
        const arr = Array.isArray(list) ? list : Object.values(list);
        setPolls(arr.filter((p) => p?.status === 'published'));
      }
      if (projectsJson) {
        const list = projectsJson?.data || projectsJson?.projects || projectsJson || [];
        const arr = Array.isArray(list) ? list : Object.values(list);
        setProjects(arr.filter((p) => p?.status === 'approved' || p?.status === 'in-progress'));
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [clientId]);

  return {
    polls,
    projects,
    pollsCount: polls.length,
    projectsCount: projects.length,
    loading,
  };
}
