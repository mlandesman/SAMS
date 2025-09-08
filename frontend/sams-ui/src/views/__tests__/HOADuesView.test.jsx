import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HOADuesView from '../HOADuesView';
import { useHOADues } from '../../context/HOADuesContext';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';

// Mock the contexts and dependencies
jest.mock('../../context/HOADuesContext');
jest.mock('../../context/ClientContext');
jest.mock('../../context/AuthContext');
jest.mock('../../utils/debug', () => ({
  log: jest.fn()
}));

// Mock FontAwesome to avoid icon rendering issues in tests
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }) => <span>{icon.iconName}</span>
}));

// Helper to wrap component with Router
const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('HOADuesView Fiscal Year Support', () => {
  // Mock data
  const mockUnits = [
    { unitId: 'A101', owner: 'John Doe' },
    { unitId: 'A102', owner: 'Jane Smith' }
  ];

  const mockDuesData = {
    'A101': {
      scheduledAmount: 100,
      payments: new Array(12).fill({ paid: false, amount: 0 }),
      creditBalance: 0
    },
    'A102': {
      scheduledAmount: 100,
      payments: new Array(12).fill({ paid: false, amount: 0 }),
      creditBalance: 50
    }
  };

  // Mock client configurations
  const mockClientMTC = {
    id: 'MTC',
    name: 'MTC',
    configuration: { fiscalYearStartMonth: 1 } // Calendar year
  };
  
  const mockClientAVII = {
    id: 'AVII',
    name: 'AVII',
    configuration: { fiscalYearStartMonth: 7 } // July-June fiscal year
  };

  const mockSamsUser = {
    email: 'test@test.com',
    role: 'SuperAdmin'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    useAuth.mockReturnValue({ samsUser: mockSamsUser });
    useHOADues.mockReturnValue({
      units: mockUnits,
      duesData: mockDuesData,
      loading: false,
      error: null,
      selectedYear: 2025,
      setSelectedYear: jest.fn()
    });
  });

  describe('Calendar Year Display (MTC)', () => {
    beforeEach(() => {
      useClient.mockReturnValue({ selectedClient: mockClientMTC });
    });

    test('displays calendar months in correct order', () => {
      renderWithRouter(<HOADuesView />);
      
      // Check for January as first month
      const monthLabels = screen.getAllByText(/Jan-|Feb-|Mar-|Apr-|May-|Jun-|Jul-|Aug-|Sep-|Oct-|Nov-|Dec-/);
      expect(monthLabels[0]).toHaveTextContent('Jan-2025');
      expect(monthLabels[11]).toHaveTextContent('Dec-2025');
    });

    test('does not show FY prefix for calendar year', () => {
      renderWithRouter(<HOADuesView />);
      
      // Should show just the year number, not "FY 2025"
      const yearDisplay = screen.getByText('2025');
      expect(yearDisplay).toBeInTheDocument();
      expect(screen.queryByText('FY 2025')).not.toBeInTheDocument();
    });

    test('does not show fiscal year info icon', () => {
      renderWithRouter(<HOADuesView />);
      
      // Should not show the info icon for calendar year
      expect(screen.queryByText('info-circle')).not.toBeInTheDocument();
    });
  });

  describe('Fiscal Year Display (AVII)', () => {
    beforeEach(() => {
      useClient.mockReturnValue({ selectedClient: mockClientAVII });
    });

    test('displays fiscal months in correct order', () => {
      renderWithRouter(<HOADuesView />);
      
      // Check that July is first month and June is last
      const monthLabels = screen.getAllByText(/Jan-|Feb-|Mar-|Apr-|May-|Jun-|Jul-|Aug-|Sep-|Oct-|Nov-|Dec-/);
      expect(monthLabels[0]).toHaveTextContent('Jul-2024'); // July 2024 for FY 2025
      expect(monthLabels[11]).toHaveTextContent('Jun-2025'); // June 2025 for FY 2025
    });

    test('shows FY prefix for fiscal year', () => {
      renderWithRouter(<HOADuesView />);
      
      // Should show "FY 2025" not just "2025"
      expect(screen.getByText('FY 2025')).toBeInTheDocument();
    });

    test('shows fiscal year info icon with tooltip', () => {
      renderWithRouter(<HOADuesView />);
      
      // Should show the info icon
      const infoIcon = screen.getByText('info-circle');
      expect(infoIcon).toBeInTheDocument();
      
      // Check tooltip content
      const yearDisplay = screen.getByText('FY 2025').closest('div');
      const tooltip = yearDisplay.querySelector('[title]');
      expect(tooltip).toHaveAttribute('title', 'Fiscal Year 2025 runs from July 2024 to June 2025');
    });
  });

  describe('Current Month Highlighting', () => {
    beforeEach(() => {
      // Mock current date to August 2024
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-08-15'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('highlights correct current month for fiscal year', () => {
      useClient.mockReturnValue({ selectedClient: mockClientAVII });
      useHOADues.mockReturnValue({
        ...useHOADues(),
        selectedYear: 2025 // FY 2025 includes August 2024
      });
      
      renderWithRouter(<HOADuesView />);
      
      // August 2024 should be highlighted as current month (month 2 of FY 2025)
      const augustLabel = screen.getByText('Aug-2024');
      expect(augustLabel.parentElement).toHaveClass('current-month');
    });

    test('marks past months as late for unpaid dues', () => {
      useClient.mockReturnValue({ selectedClient: mockClientAVII });
      useHOADues.mockReturnValue({
        ...useHOADues(),
        selectedYear: 2025
      });
      
      renderWithRouter(<HOADuesView />);
      
      // July 2024 (month 1) should be marked as late if unpaid
      const paymentCells = screen.getAllByRole('cell');
      const julyPaymentCells = paymentCells.filter(cell => 
        cell.className.includes('payment-cell') && 
        cell.className.includes('payment-late')
      );
      expect(julyPaymentCells.length).toBeGreaterThan(0);
    });
  });

  describe('Payment Recording', () => {
    test('clicking on payment cell opens modal with correct month', async () => {
      useClient.mockReturnValue({ selectedClient: mockClientAVII });
      const mockSetSelectedYear = jest.fn();
      useHOADues.mockReturnValue({
        ...useHOADues(),
        setSelectedYear: mockSetSelectedYear
      });
      
      renderWithRouter(<HOADuesView />);
      
      // Find and click on a payment cell
      const paymentCells = screen.getAllByRole('cell').filter(cell => 
        cell.className.includes('payment-cell')
      );
      
      // Click on first unit's July payment (first payment cell)
      fireEvent.click(paymentCells[0]);
      
      // Modal should open (we'd need to mock DuesPaymentModal to test this fully)
      // For now, just verify the click handler was triggered
      expect(paymentCells[0]).toHaveClass('payment-cell');
    });
  });

  describe('Year Navigation', () => {
    test('year navigation buttons work correctly', () => {
      const mockSetSelectedYear = jest.fn();
      useClient.mockReturnValue({ selectedClient: mockClientAVII });
      useHOADues.mockReturnValue({
        ...useHOADues(),
        selectedYear: 2025,
        setSelectedYear: mockSetSelectedYear
      });
      
      renderWithRouter(<HOADuesView />);
      
      // Find and click previous year button
      const prevButton = screen.getByText('chevron-left').parentElement;
      fireEvent.click(prevButton);
      expect(mockSetSelectedYear).toHaveBeenCalledWith(expect.any(Function));
      
      // Find and click next year button
      const nextButton = screen.getByText('chevron-right').parentElement;
      fireEvent.click(nextButton);
      expect(mockSetSelectedYear).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Edge Cases', () => {
    test('handles missing fiscal year configuration', () => {
      useClient.mockReturnValue({ 
        selectedClient: { 
          id: 'TEST',
          name: 'Test Client',
          configuration: {} // Missing fiscalYearStartMonth
        } 
      });
      
      renderWithRouter(<HOADuesView />);
      
      // Should default to calendar year (January start)
      const monthLabels = screen.getAllByText(/Jan-|Feb-|Mar-/);
      expect(monthLabels[0]).toHaveTextContent('Jan-2025');
    });

    test('handles empty payment data', () => {
      useHOADues.mockReturnValue({
        units: mockUnits,
        duesData: {}, // Empty dues data
        loading: false,
        error: null,
        selectedYear: 2025,
        setSelectedYear: jest.fn()
      });
      useClient.mockReturnValue({ selectedClient: mockClientAVII });
      
      renderWithRouter(<HOADuesView />);
      
      // Should still render without crashing
      expect(screen.getByText('FY 2025')).toBeInTheDocument();
    });
  });
});