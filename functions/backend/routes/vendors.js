// backend/routes/vendors.js
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import { createVendor, updateVendor, deleteVendor, listVendors } from '../controllers/vendorsController.js';

const router = express.Router({ mergeParams: true });

// Apply authentication to ALL routes in this file
router.use(authenticateUserWithProfile);

// GET /api/clients/:clientId/vendors - List all vendors for a client
router.get('/', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    
    console.log(`📋 Fetching vendors for client: ${clientId}`);
    const vendors = await listVendors(clientId, req.user);
    
    res.json({
      success: true,
      data: vendors,
      count: vendors.length
    });
  } catch (error) {
    console.error('❌ Error fetching vendors:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch vendors' 
    });
  }
});

// POST /api/clients/:clientId/vendors - Create a new vendor
router.post('/', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const vendorData = req.body;
    
    if (!vendorData.name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vendor name is required' 
      });
    }

    console.log(`➕ Creating vendor for client: ${clientId}`, vendorData);
    const vendorId = await createVendor(clientId, vendorData, req.user);
    
    if (!vendorId) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create vendor' 
      });
    }

    res.json({
      success: true,
      data: { id: vendorId, ...vendorData },
      message: 'Vendor created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating vendor:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create vendor' 
    });
  }
});

// PUT /api/clients/:clientId/vendors/:vendorId - Update a vendor
router.put('/:vendorId', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const vendorId = req.params.vendorId;
    const updateData = req.body;
    
    if (!vendorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vendor ID is required' 
      });
    }

    console.log(`✏️ Updating vendor ${vendorId} for client: ${clientId}`, updateData);
    const success = await updateVendor(clientId, vendorId, updateData, req.user);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update vendor' 
      });
    }

    // Fetch the updated vendor to return complete data
    const updatedVendor = await listVendors(clientId, req.user);
    const vendor = updatedVendor.find(v => v.id === vendorId);
    
    res.json({
      success: true,
      data: vendor || { id: vendorId, ...updateData },
      message: 'Vendor updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating vendor:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update vendor' 
    });
  }
});

// DELETE /api/clients/:clientId/vendors/:vendorId - Delete a vendor
router.delete('/:vendorId', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const vendorId = req.params.vendorId;
    
    if (!vendorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vendor ID is required' 
      });
    }

    console.log(`🗑️ Deleting vendor ${vendorId} for client: ${clientId}`);
    const success = await deleteVendor(clientId, vendorId, req.user);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to delete vendor' 
      });
    }

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting vendor:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete vendor' 
    });
  }
});

export default router;
