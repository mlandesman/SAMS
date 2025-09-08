/**
 * testAllCRUD.js
 * 
 * Master test script to verify all CRUD modules are working
 */

const {
  createClient,
  updateClient,
  deleteClient,
  listClients,
} = require('../src/CRUD/clients');

const {
  createUnit,
  updateUnit,
  deleteUnit,
  listUnits,
} = require('../src/CRUD/units');

const {
  createBudget,
  updateBudget,
  deleteBudget,
  listBudgets,
} = require('../src/CRUD/budgets');

const {
  createCategory,
  updateCategory,
  deleteCategory,
  listCategories,
} = require('../src/CRUD/categories');

const {
  createVendor,
  updateVendor,
  deleteVendor,
  listVendors,
} = require('../src/CRUD/vendors');

const {
  createProject,
  updateProject,
  deleteProject,
  listProjects,
} = require('../src/CRUD/projects');

const {
  createOwner,
  updateOwner,
  deleteOwner,
  listOwners,
} = require('../src/CRUD/owners');

const {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listTransactions,
} = require('../src/CRUD/transactions');

async function runTests() {
  console.log('🚀 Starting Full System CRUD Test...');

  // -- Clients --
  const clientId = await createClient({
    fullName: 'Test Client Example',
    email: 'test@example.com',
    phone: '+1-555-555-5555',
    notes: 'This is a dummy client for full CRUD test',
  });

  await updateClient(clientId, {
    fullName: 'Test Client Updated',
    email: 'updated@example.com',
  });

  const clients = await listClients();
  console.table(clients);

  // -- Units --
  const unitId = await createUnit(clientId, {
    unitId: 'PH9Z',
    unitName: 'Penthouse 9Z',
    type: ['Condo'],
    owners: ['unitowner1@example.com'],
    percentOwned: 8.5,
    duesAmount: 4100,
    contractDate: new Date('2023-01-01'),
    contractEnd: new Date('2026-12-31'),
    accessCode: '1234',
    lastHOA: new Date('2025-04-01'),
    active: true,
  });

  await updateUnit(clientId, unitId, { unitName: 'Penthouse 9Z Updated' });

  const units = await listUnits(clientId);
  console.table(units);

  // -- Budgets --
  const budgetId = await createBudget(clientId, '2025', 'expense', {
    category: 'Utilities',
    amount: 50000,
  });

  await updateBudget(clientId, '2025', 'expense', budgetId, { amount: 52000 });

  const budgets = await listBudgets(clientId, '2025', 'expense');
  console.table(budgets);

  // -- Categories --
  const categoryId = await createCategory(clientId, {
    name: 'Maintenance',
    description: 'Maintenance and repairs',
  });

  await updateCategory(clientId, categoryId, { description: 'Updated description' });

  const categories = await listCategories(clientId);
  console.table(categories);

  // -- Vendors --
  const vendorId = await createVendor(clientId, {
    name: 'Otis Elevators',
    service: 'Elevator Maintenance',
    contactEmail: 'otis@example.com',
    phone: '+1-999-999-9999',
  });

  await updateVendor(clientId, vendorId, { phone: '+1-888-888-8888' });

  const vendors = await listVendors(clientId);
  console.table(vendors);

  // -- Projects --
  const projectId = await createProject(clientId, '2025', 'proposed', {
    projectName: 'Lobby Renovation',
    description: 'Complete renovation of lobby',
    estimatedCost: 200000,
  });

  await updateProject(clientId, '2025', 'proposed', projectId, { estimatedCost: 210000 });

  const projects = await listProjects(clientId, '2025', 'proposed');
  console.table(projects);

  // -- Owners --
  const ownerId = await createOwner(clientId, {
    fullName: 'Jane Doe',
    emails: ['jane@example.com'],
    whatsapp: '+52-123-123-1234',
    units: ['PH9Z'],
  });

  await updateOwner(clientId, ownerId, { fullName: 'Jane Doe Updated' });

  const owners = await listOwners(clientId);
  console.table(owners);

  // -- Transactions --
  const txnId = await createTransaction(clientId, {
    unitId: 'PH9Z',
    date: new Date(),
    amount: 5000,
    currency: 'MXN',
    type: 'Expense',
    category: 'Repairs',
    note: 'Plumbing repair',
    createdBy: 'admin',
  });

  await updateTransaction(clientId, txnId, { amount: 5500 });

  const txns = await listTransactions(clientId);
  console.table(txns);

  // -- Deletions (Reverse Order) --
  await deleteTransaction(clientId, txnId);
  await deleteOwner(clientId, ownerId);
  await deleteProject(clientId, '2025', 'proposed', projectId);
  await deleteVendor(clientId, vendorId);
  await deleteCategory(clientId, categoryId);
  await deleteBudget(clientId, '2025', 'expense', budgetId);
  await deleteUnit(clientId, unitId);
  await deleteClient(clientId);

  console.log('✅ Full System CRUD Test Completed.');
}

runTests().catch((error) => {
  console.error('❌ Error during full CRUD test:', error);
});