import React, { useState } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import { getColorScheme } from '../utils/colorSchemes';
import './Calculator.css';

const Calculator: React.FC = () => {
  const { colorScheme } = useDesktop();
  const currentColorScheme = getColorScheme(colorScheme);
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState(true);

  const handleNumber = (num: string) => {
    if (newNumber) {
      setDisplay(num);
      setNewNumber(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperator = (op: string) => {
    const currentValue = parseFloat(display);
    
    if (previousValue === null) {
      setPreviousValue(currentValue);
    } else if (operation) {
      const result = calculate(previousValue, currentValue, operation);
      setDisplay(String(result));
      setPreviousValue(result);
    }
    
    setOperation(op);
    setNewNumber(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (operation && previousValue !== null) {
      const result = calculate(previousValue, parseFloat(display), operation);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperation(null);
      setNewNumber(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setNewNumber(true);
  };

  const handleDecimal = () => {
    if (!display.includes('.')) {
      setDisplay(display + '.');
      setNewNumber(false);
    }
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
      setNewNumber(true);
    }
  };

  const buttons = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['±', '0', '.', '='],
  ];

  const handleClick = (value: string) => {
    if (value >= '0' && value <= '9') {
      handleNumber(value);
    } else if (['+', '-', '×', '÷'].includes(value)) {
      handleOperator(value);
    } else if (value === '=') {
      handleEquals();
    } else if (value === 'C') {
      handleClear();
    } else if (value === '.') {
      handleDecimal();
    } else if (value === '⌫') {
      handleBackspace();
    } else if (value === '%') {
      setDisplay(String(parseFloat(display) / 100));
    } else if (value === '±') {
      setDisplay(String(parseFloat(display) * -1));
    }
  };

  return (
    <div className="calculator">
      <div className="calculator-display">{display}</div>
      <div className="calculator-buttons">
        {buttons.map((row, rowIndex) => (
          <div key={rowIndex} className="calculator-row">
            {row.map((btn) => (
              <button
                key={btn}
                className={`calculator-button ${
                  ['+', '-', '×', '÷', '='].includes(btn) ? 'operator' : ''
                } ${btn === 'C' ? 'clear' : ''} ${btn === '=' ? 'equals' : ''}`}
                onClick={() => handleClick(btn)}
                style={{
                  background: btn === '=' ? currentColorScheme.gradient : undefined,
                  borderColor: ['+', '-', '×', '÷', '='].includes(btn) ? currentColorScheme.primary : undefined,
                }}
              >
                {btn}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calculator;
