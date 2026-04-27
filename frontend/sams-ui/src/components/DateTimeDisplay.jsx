import React, { useState, useEffect } from 'react';
import { useDesktopLanguage } from '../context/DesktopLanguageContext';
import { getMexicoDateTime } from '../utils/timezone';

function DateTimeDisplay() {
  const [currentDateTime, setCurrentDateTime] = useState(getMexicoDateTime());
  const { language } = useDesktopLanguage();

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentDateTime(getMexicoDateTime());
    }, 1000); // Update every second

    return () => {
      clearInterval(timerId); // Cleanup interval on component unmount
    };
  }, []);

  const formatDate = (date) => {
    const locale = language === 'ES' ? 'es-MX' : 'en-US';
    return date.toLocaleString(locale, {
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