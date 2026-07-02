import React, { useState, useEffect, useRef } from 'react';
import './ChatPanel.css';

export default function ChatPanel({ messages, onSendMessage, isOpen, onToggle, unreadCount }) {
    const [inputText, setInputText] = useState('');
    const listEndRef = useRef(null);

    useEffect(() => {
        if (
            isOpen &&
            listEndRef.current &&
            typeof listEndRef.current.scrollIntoView === 'function'
        ) {
            listEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        onSendMessage(inputText.trim());
        setInputText('');
    };

    return (
        <div className={`chat-panel-container ${isOpen ? 'open' : 'collapsed'}`}>
            <button className="chat-toggle-btn" onClick={onToggle}>
                💬 {unreadCount > 0 && <span className="unread-dot">{unreadCount}</span>}
            </button>

            {isOpen && (
                <div className="chat-panel">
                    <div className="chat-header">
                        <h3>COMM LINK</h3>
                        <button className="close-btn" onClick={onToggle}>
                            ✕
                        </button>
                    </div>
                    <div className="chat-messages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chat-message ${msg.senderId}`}>
                                <span className="sender">{msg.senderName}:</span>
                                <span className="text">{msg.text}</span>
                            </div>
                        ))}
                        <div ref={listEndRef} />
                    </div>
                    <form onSubmit={handleSubmit} className="chat-input-form">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type a message..."
                            maxLength={200}
                        />
                        <button type="submit">Send</button>
                    </form>
                </div>
            )}
        </div>
    );
}
