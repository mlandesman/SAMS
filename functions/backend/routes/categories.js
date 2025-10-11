// backend/routes/categories.js
import express from 'express';
const router = express.Router();
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import { 
  listCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory 
} from '../controllers/categoriesController.js';

// Apply authentication to ALL routes in this file
router.use(authenticateUserWithProfile);

// List all categories for a client
router.get('/', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    console.log('📋 Categories route - fetching for client:', clientId);
    
    const categories = await listCategories(clientId, req.user);
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('❌ Error in categories list route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a new category
router.post('/', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    console.log('➕ Categories route - creating for client:', clientId);
    
    const { name, description, type, status } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required'
      });
    }

    const categoryId = await createCategory(clientId, {
      name,
      description: description || '',
      type: type || 'expense',
      status: status || 'active'
    }, req.user);

    if (categoryId) {
      res.json({
        success: true,
        data: { id: categoryId },
        message: 'Category created successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create category'
      });
    }
  } catch (error) {
    console.error('❌ Error in category creation route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update a category
router.put('/:categoryId', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const categoryId = req.params.categoryId;
    console.log('✏️ Categories route - updating category:', categoryId, 'for client:', clientId);
    
    const success = await updateCategory(clientId, categoryId, req.body, req.user);
    
    if (success) {
      // Fetch the updated category to return complete data
      const updatedCategories = await listCategories(clientId, req.user);
      const category = updatedCategories.find(c => c.id === categoryId);
      
      res.json({
        success: true,
        data: category || { id: categoryId, ...req.body },
        message: 'Category updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update category'
      });
    }
  } catch (error) {
    console.error('❌ Error in category update route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a category
router.delete('/:categoryId', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const categoryId = req.params.categoryId;
    console.log('🗑️ Categories route - deleting category:', categoryId, 'for client:', clientId);
    
    const success = await deleteCategory(clientId, categoryId, req.user);
    
    if (success) {
      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete category'
      });
    }
  } catch (error) {
    console.error('❌ Error in category deletion route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
