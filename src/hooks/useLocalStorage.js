import { useState, useEffect } from 'react';

/**
 * A hook that mirrors useState but persists the value in localStorage.
 *
 * @param {string} key - The localStorage key
 * @param {*} initialValue - The default value when nothing is stored yet
 * @returns {[*, Function]} A stateful value and a setter function
 */
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch (err) {
      console.warn(`useLocalStorage: failed to read key "${key}"`, err);
      return initialValue;
    }
  });

  // Keep localStorage in sync whenever the value changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (err) {
      console.warn(`useLocalStorage: failed to write key "${key}"`, err);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
