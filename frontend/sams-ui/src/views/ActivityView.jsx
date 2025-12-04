import React from 'react';
import { useParams } from 'react-router-dom';
import DashboardView from './DashboardView';
import TransactionsView from './TransactionsView';
import HOADuesView from './HOADuesView';
import WaterBillsSimple from './WaterBillsSimple';
import ListManagementView from './ListManagementView';
import SettingsView from './SettingsView';
import ReportsView from './ReportsView';
import BudgetView from './BudgetView';
import { HOADuesProvider } from '../context/HOADuesContext';
import { WaterBillsProvider } from '../context/WaterBillsContext';
import { ListManagementProvider } from '../context/ListManagementContext';
import './ActivityView.css';

// Map of activity names to view components
const ACTIVITY_VIEWS = {
  'dashboard': DashboardView,
  'transactions': TransactionsView,
  'hoadues': () => (
    <HOADuesProvider>
      <HOADuesView />
    </HOADuesProvider>
  ),
  'waterbills': () => <WaterBillsSimple />,
  'reports': () => <ReportsView />,
  // We could dynamically load these, but for now we'll handle unimplemented views with a placeholder
  'projects': () => <PlaceholderView title="Projects" />,
  'budgets': () => <BudgetView />,
  'listmanagement': () => (
    <ListManagementProvider>
      <ListManagementView />
    </ListManagementProvider>
  ), // Match the exact case from the menu config
  'settings': () => <SettingsView />,
  'users': () => (
    <ListManagementProvider>
      <ListManagementView />
    </ListManagementProvider>
  ) // User Management is handled by ListManagementView with Users tab
};

function ActivityView() {
  const { activity } = useParams();
  const lowerActivity = activity ? activity.toLowerCase() : 'dashboard';
  
  // Get the component for this activity, or default to a placeholder
  const ViewComponent = ACTIVITY_VIEWS[lowerActivity] || (() => <PlaceholderView title={activity} />);
  
  // Use useEffect to log which activity is being rendered
  React.useEffect(() => {
    console.log(`Rendering activity view for: ${activity}`);
  }, [activity]);
  
  return <ViewComponent />;
}

// Placeholder for activities without a dedicated view
function PlaceholderView({ title }) {
  const { activity } = useParams();
  const displayTitle = title || activity;
  
  return (
    <div className="placeholder-view">
      <h1>{displayTitle}</h1>
      <p>This feature is coming soon.</p>
    </div>
  );
}

export default ActivityView;
