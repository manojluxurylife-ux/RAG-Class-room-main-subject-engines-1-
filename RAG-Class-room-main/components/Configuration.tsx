'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { CheckCircle2 } from 'lucide-react';

export function Configuration() {
  const [active, setActive] = useState(false);
  const [key, setKey] = useState('');

  useEffect(() => {
    if (localStorage.getItem('CONFIG_ACTIVE') === 'true') {
      setActive(true);
    }
  }, []);

  const handleActivate = () => {
    if (key) {
      // Simplified storage as requested
      localStorage.setItem('UPSTASH_REDIS_REST_URL', key);
      localStorage.setItem('CONFIG_ACTIVE', 'true');
      setActive(true);
    }
  };

  return (
    <div className="mt-8 rounded-lg border border-chalk/20 p-4">
      {active ? (
        <div className="flex items-center gap-2 text-green-500">
          <CheckCircle2 size={24} />
          <span className="font-semibold">🎉 Active</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your configuration key"
            className="rounded border border-chalk/20 bg-transparent p-2 text-chalk"
          />
          <Button onClick={handleActivate}>Activate</Button>
        </div>
      )}
    </div>
  );
}
