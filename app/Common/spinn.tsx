import React from 'react';
import './Spinner.css';

interface SpinnerProps {
  size?: 'small';
}

const Spinner: React.FC<SpinnerProps> = ({ size }) => {
  // This allows us to have different spinner sizes, like in your original code
  const spinnerClass = `spinner ${size === 'small' ? 'small' : ''}`;
  return <div className={spinnerClass}></div>;
};

export default Spinner;