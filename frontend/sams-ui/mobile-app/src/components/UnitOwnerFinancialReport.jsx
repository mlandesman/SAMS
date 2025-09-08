import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuthStable.jsx';

const UnitOwnerFinancialReport = () => {
  const { samsUser, currentClient } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [duesData, setDuesData] = useState(null);

  // Mock data - in real implementation, this would come from API
  useEffect(() => {
    const mockTransactions = [
      {
        id: '1',
        date: '2025-06-15',
        description: 'HOA Dues Payment - June 2025',
        amount: 5000,
        category: 'HOA Dues',
        reference: 'HOA-2025-06'
      },
      {
        id: '2',
        date: '2025-05-15',
        description: 'HOA Dues Payment - May 2025',
        amount: 5000,
        category: 'HOA Dues',
        reference: 'HOA-2025-05'
      },
      {
        id: '3',
        date: '2025-04-15',
        description: 'HOA Dues Payment - April 2025',
        amount: 5000,
        category: 'HOA Dues',
        reference: 'HOA-2025-04'
      },
      {
        id: '4',
        date: '2025-03-20',
        description: 'Special Assessment - Building Maintenance',
        amount: 2500,
        category: 'Special Assessment',
        reference: 'SA-2025-01'
      }
    ];

    const mockDuesData = {
      unitId: '1A',
      ownerName: 'John Smith',
      monthlyAmount: 5000,
      creditBalance: 1250,
      months: [
        { number: 1, name: 'Jan', status: 'paid' },
        { number: 2, name: 'Feb', status: 'paid' },
        { number: 3, name: 'Mar', status: 'paid' },
        { number: 4, name: 'Apr', status: 'paid' },
        { number: 5, name: 'May', status: 'paid' },
        { number: 6, name: 'Jun', status: 'paid' },
        { number: 7, name: 'Jul', status: 'future' },
        { number: 8, name: 'Aug', status: 'future' },
        { number: 9, name: 'Sep', status: 'future' },
        { number: 10, name: 'Oct', status: 'future' },
        { number: 11, name: 'Nov', status: 'future' },
        { number: 12, name: 'Dec', status: 'future' },
      ]
    };

    // Simulate API delay
    setTimeout(() => {
      setTransactions(mockTransactions);
      setDuesData(mockDuesData);
      setLoading(false);
    }, 1000);
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={2} pb={10}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          My Financial Report
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your 2025 transactions and HOA dues status
        </Typography>
      </Box>

      {/* Unit Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <HomeIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">Unit Information</Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">Unit</Typography>
              <Typography variant="h6">{duesData.unitId}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">Owner</Typography>
              <Typography variant="h6">{duesData.ownerName}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">Monthly Dues</Typography>
              <Typography variant="h6">{formatCurrency(duesData.monthlyAmount)}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">Credit Balance</Typography>
              <Typography variant="h6" color="success.main">
                {formatCurrency(duesData.creditBalance)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* HOA Dues Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <BalanceIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">2025 HOA Dues Status</Typography>
          </Box>
          
          <Grid container spacing={1}>
            {duesData.months.map((month) => (
              <Grid item xs={3} sm={2} md={1} key={month.number}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    textAlign: 'center',
                    backgroundColor: month.status === 'paid' ? 'success.light' : 
                                   month.status === 'overdue' ? 'error.light' : 'grey.100'
                  }}
                >
                  <CardContent sx={{ py: 1, px: 0.5 }}>
                    <Typography variant="caption" display="block">
                      {month.name}
                    </Typography>
                    <Box display="flex" justifyContent="center" mt={0.5}>
                      {month.status === 'paid' && <CheckIcon color="success" fontSize="small" />}
                      {month.status === 'overdue' && <XIcon color="error" fontSize="small" />}
                      {month.status === 'future' && (
                        <Typography variant="caption" color="text.disabled">-</Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Alert severity="success" sx={{ mt: 2 }}>
            You are current on all HOA dues payments. Next payment due: July 1, 2025
          </Alert>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <ReportIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">Your 2025 Transactions</Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Category</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{formatDate(transaction.date)}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell align="right">
                      <Typography color="primary" fontWeight="medium">
                        {formatCurrency(transaction.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={transaction.category} 
                        size="small" 
                        variant="outlined"
                        color={transaction.category === 'HOA Dues' ? 'primary' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
            <Typography variant="body2" color="text.secondary">
              <strong>Total Paid in 2025:</strong> {formatCurrency(
                transactions.reduce((sum, t) => sum + t.amount, 0)
              )}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UnitOwnerFinancialReport;
