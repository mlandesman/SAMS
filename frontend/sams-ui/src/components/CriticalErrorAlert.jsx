import React, { useState, useEffect } from 'react';
import { Alert, Badge, Button, Modal, Table } from 'react-bootstrap';
import { FaExclamationTriangle, FaTimes, FaSync } from 'react-icons/fa';
import api from '../api/client';

const CriticalErrorAlert = () => {
  const [errors, setErrors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedError, setSelectedError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check for critical errors every 30 seconds
  useEffect(() => {
    checkCriticalErrors();
    const interval = setInterval(checkCriticalErrors, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkCriticalErrors = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get('/api/system/critical-errors');
      setErrors(response.data.errors || []);
    } catch (error) {
      console.error('Failed to check critical errors:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleErrorClick = (error) => {
    setSelectedError(error);
    setShowModal(true);
  };

  const getSeverityVariant = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'warning';
      default: return 'info';
    }
  };

  if (errors.length === 0) return null;

  return (
    <>
      <Alert variant="danger" className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center">
          <FaExclamationTriangle className="me-2" size={20} />
          <strong>Critical System Errors Detected!</strong>
          <Badge bg="danger" className="ms-2">{errors.length}</Badge>
        </div>
        <div>
          <Button 
            variant="outline-light" 
            size="sm" 
            className="me-2"
            onClick={checkCriticalErrors}
            disabled={isRefreshing}
          >
            <FaSync className={isRefreshing ? 'fa-spin' : ''} />
          </Button>
          <Button 
            variant="light" 
            size="sm"
            onClick={() => setShowModal(true)}
          >
            View Details
          </Button>
        </div>
      </Alert>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExclamationTriangle className="text-danger me-2" />
            Critical System Errors
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedError ? (
            <div>
              <h5>{selectedError.type}</h5>
              <Table bordered>
                <tbody>
                  <tr>
                    <td width="30%"><strong>Severity</strong></td>
                    <td>
                      <Badge bg={getSeverityVariant(selectedError.severity)}>
                        {selectedError.severity}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Time</strong></td>
                    <td>{new Date(selectedError.timestamp).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td><strong>Endpoint</strong></td>
                    <td><code>{selectedError.endpoint}</code></td>
                  </tr>
                  <tr>
                    <td><strong>Message</strong></td>
                    <td>
                      <Alert variant="danger" className="mb-0">
                        {selectedError.message}
                      </Alert>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>User</strong></td>
                    <td>{selectedError.user}</td>
                  </tr>
                </tbody>
              </Table>
              <Button 
                variant="secondary" 
                onClick={() => setSelectedError(null)}
              >
                Back to List
              </Button>
            </div>
          ) : (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((error, index) => (
                  <tr key={index}>
                    <td>{error.type}</td>
                    <td>
                      <Badge bg={getSeverityVariant(error.severity)}>
                        {error.severity}
                      </Badge>
                    </td>
                    <td>{new Date(error.timestamp).toLocaleString()}</td>
                    <td>
                      <Button 
                        variant="link" 
                        size="sm"
                        onClick={() => handleErrorClick(error)}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default CriticalErrorAlert;