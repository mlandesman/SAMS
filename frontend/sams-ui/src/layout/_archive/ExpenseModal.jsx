// /frontend/src/components/ExpenseModal.js
import React, { useState } from 'react';
import './ExpenseModal.css'; // You can create this file for styling

const ExpenseModal = ({ vendors = [], categories = [], paymentMethods = [], onClose, onSubmit }) => {
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    const expense = {
      vendor,
      notes,
      category,
      paymentMethod,
      amount: parseFloat(amount) * -1 // Convert to negative
    };

    onSubmit(expense);
  };

  return (

    <div className="modal-content">
      <button onClick={onClose} className="modal-close">×</button>
      <div className="modal-header">Expense Data Entry</div>
      <div className="modal-form"> {/* <-- ADD THIS WRAPPER */}
        {/* Form fields here */}
        <label>Vendor:</label>
        <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option value="">Select a vendor</option>
          {vendors.map((v) => (
            <option key={v.name} value={v.name}>{v.name}</option>
          ))}
        </select>

        <label>Transaction Notes:</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows="2"
        ></textarea>

        <label>Expense Category:</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>

        <label>Payment Method:</label>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="">Select a method</option>
          {paymentMethods.map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>

        <label>Amount:</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
        />

        <div className="modal-actions">
          <button type="submit" onClick={handleSubmit}>
            Submit
          </button>
        </div>
      </div>
    </div>

  );
};

export default ExpenseModal;