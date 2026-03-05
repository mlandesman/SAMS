import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HOADuesTransactionCard.css';

/**
 * Component to display HOA Dues metadata and provide navigation
 * to the HOA Dues view for a specific unit and year
 */
function HOADuesTransactionCard({ metadata }) {
  const navigate = useNavigate();

  if (!metadata || metadata.type !== 'hoa_dues') {
    return null;
  }

  const { unitId, year, months } = metadata;
  
  const handleNavigateToHOADues = () => {
    // Navigate to HOA Dues view with the specific unit and year
    navigate(`/hoadues?unitId=${unitId}&year=${year}`);
  };
  
  // Format the months in a user-friendly way
  const formatMonthsList = (months) => {
    if (!months || months.length === 0) {
      return 'No months specified';
    }
    
    // Month names array (1-indexed to match month numbers)
    const MONTH_NAMES_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Sort months numerically
    const sortedMonths = [...months].sort((a, b) => a - b);
    
    // Get month names
    const monthNames = sortedMonths.map(month => MONTH_NAMES_SHORT[month] || '?');
    
    // Display as comma-separated list
    return monthNames.join(', ');
  };

  return (
    <div className="hoa-dues-transaction-card">
      <h3>HOA Dues Payment Details</h3>
      <div className="hoa-dues-metadata">
        <p><strong>Unit:</strong> {unitId}</p>
        <p><strong>Year:</strong> {year}</p>
        <p><strong>Months Covered:</strong> {formatMonthsList(months)}</p>
      </div>
      <button 
        className="view-dues-button"
        onClick={handleNavigateToHOADues}
      >
        View in HOA Dues
      </button>
    </div>
  );
}

export default HOADuesTransactionCard;
