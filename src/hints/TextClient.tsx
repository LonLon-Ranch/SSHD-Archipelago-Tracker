import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSelector } from 'react-redux';
import { ClientManagerContext } from '../archipelago/ClientHooks';
import { itemLocationAssignmentEnabledSelector } from '../customization/Selectors';
import { ItemAssignmentStatus } from './ItemAssignmentStatus';
import styles from './TextClient.module.css';

// Just a basic text client for now
export function TextClient() {
    const lastItem = useRef<HTMLLIElement>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const [currMsg, setCurrMsg] = useState('');
    const autoItemAssignemt = useSelector(
        itemLocationAssignmentEnabledSelector,
    );
    const clientManager = useContext(ClientManagerContext);
    useEffect(() => {
        clientManager?.setOnMessage((msgs: string[]) => setMessages([...msgs]));
    }, [clientManager]);

    useEffect(() => {
        lastItem.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, lastItem]);

    const sendMessage = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        clientManager?.sendMessage(currMsg);
        setCurrMsg('');
    };
    return (
        <div className={styles.textClient}>
            <ul className={styles.apMessages}>
                {messages.map((msg, idx) => {
                    if (idx === messages.length - 1) {
                        return (
                            <li key={idx} ref={lastItem}>
                                {msg}
                            </li>
                        );
                    }
                    return <li key={idx}>{msg}</li>;
                })}
            </ul>
            <form onSubmit={sendMessage}>
                <input
                    type="text"
                    className="tracker-input"
                    disabled={!clientManager?.isHooked()}
                    placeholder="Enter a command here"
                    value={currMsg ?? ''}
                    onChange={(e) => setCurrMsg(e.target.value)}
                />
            </form>
            {autoItemAssignemt && <ItemAssignmentStatus />}
        </div>
    );
}
