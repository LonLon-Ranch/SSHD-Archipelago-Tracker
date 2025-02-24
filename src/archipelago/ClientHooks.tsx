import { createContext, useState, type ReactNode } from 'react';
import { APClientManager } from './Archipelago';

export const ClientManagerContext = createContext<APClientManager | null>(null);

export function MakeClientAvailable({ children }: { children: ReactNode }) {
    const [manager, _] = useState(() => new APClientManager());
    return (
        <ClientManagerContext value={manager}>{children}</ClientManagerContext>
    );
}
