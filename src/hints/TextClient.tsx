import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSelector } from 'react-redux';
import Tooltip from '../additionalComponents/Tooltip';
import type { ClientMessage, ColoredText } from '../archipelago/Archipelago';
import {
    ClientManagerContext,
    useIsApConnected,
} from '../archipelago/ClientHooks';
import { itemLocationAssignmentEnabledSelector } from '../customization/Selectors';
import { ItemAssignmentStatus } from './ItemAssignmentStatus';
import styles from './TextClient.module.css';

// Text client with color-coded nodes and tooltips to mirror that of the CommonClient
export function TextClient() {
    const lastItem = useRef<HTMLLIElement>(null);
    const [messages, setMessages] = useState<ClientMessage[]>([]);
    const [currMsg, setCurrMsg] = useState('');
    const autoItemAssignemt = useSelector(
        itemLocationAssignmentEnabledSelector,
    );
    const clientManager = useContext(ClientManagerContext);
    useEffect(() => {
        clientManager?.setOnMessage((msgs: ClientMessage[]) =>
            setMessages([...msgs]),
        );
    }, [clientManager]);

    useEffect(() => {
        lastItem.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, lastItem]);

    const sendMessage = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        clientManager?.sendMessage(currMsg);
        setCurrMsg('');
    };

    const isConnected = useIsApConnected();

    const getColorStyle = (ctxt: ColoredText) => {
        if (ctxt.customColor) return { color: ctxt.customColor };
        if (ctxt.color) return { color: `var(--scheme-${ctxt.color})` };
        return {};
    };

    const renderMessage = (msg: ClientMessage) => {
        return msg.map((ctxt, idx) => (
            <Tooltip
                disabled={ctxt.tooltip === undefined}
                content={ctxt.tooltip}
                placement="bottom"
                key={idx}
            >
                <span
                    style={{
                        cursor: 'default',
                        ...getColorStyle(ctxt),
                    }}
                >
                    {ctxt.text}
                </span>
            </Tooltip>
        ));
    };

    return (
        <div className={styles.textClient}>
            <ul className={styles.apMessages}>
                {messages.map((msg, idx) => {
                    if (idx === messages.length - 1) {
                        return (
                            <li key={idx} ref={lastItem}>
                                {renderMessage(msg)}
                            </li>
                        );
                    }
                    return <li key={idx}>{renderMessage(msg)}</li>;
                })}
            </ul>
            <form onSubmit={sendMessage}>
                <input
                    type="text"
                    className="tracker-input"
                    disabled={!isConnected}
                    placeholder="Enter a command here"
                    value={currMsg ?? ''}
                    onChange={(e) => setCurrMsg(e.target.value)}
                />
            </form>
            {autoItemAssignemt && <ItemAssignmentStatus />}
        </div>
    );
}
