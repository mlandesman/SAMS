import React, { useState, useEffect } from 'react';

function DateTimeDisplay() {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000); // Update every second

    return () => {
      clearInterval(timerId); // Cleanup interval on component unmount
    };
  }, []);

  const formatDate = (date) => {
    // Example format: May 13, 2025 10:30:45 AM
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="datetime-display">
      {formatDate(currentDateTime)}
    </div>
  );
}

export default DateTimeDisplay;