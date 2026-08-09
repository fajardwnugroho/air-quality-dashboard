'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getStoredTimezone, setStoredTimezone } from '@/lib/timezone';

interface TimezoneContextValue {
  timezone: string;
  setTimezone: (tz: string) => void;
}

const TimezoneContext = createContext<TimezoneContextValue>({
  timezone: 'UTC',
  setTimezone: () => {},
});

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [timezone, setTimezoneState] = useState('UTC');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezoneState(getStoredTimezone());
  }, []);

  function setTimezone(tz: string) {
    setTimezoneState(tz);
    setStoredTimezone(tz);
  }

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  return useContext(TimezoneContext);
}
