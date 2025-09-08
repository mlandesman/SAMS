import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ListManagementView from './views/ListManagementView';
import './App.css';

// Simple test app for the ListManagementView
function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<ListManagementView />} />
      </Routes>
    </div>
  );
}

export default App;
