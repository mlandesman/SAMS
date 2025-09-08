// src/Layout.jsx
import React from 'react';
import './Layout.css';

function Layout({ children }) {
  const clientName = "Sandyland Properties"; // Replace with actual client name

  return (
    <div className="layout-container">
      <div className="sidebar">Sidebar</div>
      <div className="main-content">
        <div className="content">{children}</div>
        <div className="status-bar">Status Bar</div>
      </div>
    </div>
  );
}

export default Layout;