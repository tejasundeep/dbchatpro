import { useState, useEffect, useRef } from 'react';
import { AiOutlineSetting } from "react-icons/ai";
import { BsArrowUpCircleFill } from "react-icons/bs";
import { RiDeleteBin6Line, RiEdit2Fill } from "react-icons/ri";
import { FaGooglePlay, FaReply } from "react-icons/fa";
import styles from '@/styles/Chat.module.css';

export default function Home() {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionMessage, setConnectionMessage] = useState('');
    const [dbCredentials, setDbCredentials] = useState({
        host: '', port: '', user: '', password: '', database: '', dbType: 'postgres',
    });
    const [input, setInput] = useState('');
    const [chatHistory, setChatHistory] = useState([{ sender: 'bot', message: 'How can I help you?' }]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);
    const [editInput, setEditInput] = useState('');
    const modalRef = useRef(null);
    const endOfMessagesRef = useRef(null);

    useEffect(() => {
        if (endOfMessagesRef.current) {
            setTimeout(() => {
                endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [chatHistory]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            setIsConnected(localStorage.getItem('isConnected') === 'true');
            setDbCredentials(JSON.parse(localStorage.getItem('dbCredentials')) || dbCredentials);
            setChatHistory(JSON.parse(localStorage.getItem('chatHistory')) || chatHistory);
            setConnectionMessage(isConnected ? 'Database connected successfully!' : '');
        } catch (error) {
            console.error('Error loading data from localStorage:', error);
        }
    }, []);

    useEffect(() => localStorage.setItem('dbCredentials', JSON.stringify(dbCredentials)), [dbCredentials]);
    useEffect(() => localStorage.setItem('isConnected', isConnected.toString()), [isConnected]);
    useEffect(() => localStorage.setItem('chatHistory', JSON.stringify(chatHistory)), [chatHistory]);

    const handleSettingsToggle = () => {
        setIsSettingsOpen(!isSettingsOpen);
        setErrorMessage('');
    };

    const handleChange = ({ target: { name, value } }) => {
        setDbCredentials(prev => ({ ...prev, [name]: value.trim() }));
    };

    const handleConnect = async () => {
        const { host, port, user, password, database } = dbCredentials;
        if (!host || !port || isNaN(parseInt(port)) || !user || !password || !database) {
            setErrorMessage('All database fields are required, and port must be a number.');
            return;
        }

        try {
            const response = await fetch('/api/connectDatabase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbCredentials),
            });
            const data = await response.json();

            if (response.ok && data?.success) {
                setIsConnected(true);
                setConnectionMessage('Database connected successfully!');
                setIsSettingsOpen(false);
            } else {
                setConnectionMessage(data?.message || 'Failed to connect to the database.');
            }
        } catch (error) {
            console.error('Connection error:', error);
            setConnectionMessage('Failed to connect to the database.');
        }
    };

    const handleDisconnect = () => {
        setIsConnected(false);
        setConnectionMessage('');
        setDbCredentials({ host: '', port: '', user: '', password: '', database: '', dbType: 'postgres' });
        localStorage.removeItem('dbCredentials');
        localStorage.setItem('isConnected', 'false');
    };

    const handleEditMessage = (index, message) => {
        setEditingIndex(index);
        setEditInput(message);
    };

    const handleSaveEdit = () => {
        setChatHistory(prev => prev.map((chat, index) =>
            index === editingIndex ? { ...chat, message: editInput || 'None' } : chat
        ));
        setEditingIndex(null);
        setEditInput('');
    };

    const handleReply = (message) => {
        setInput(`Based on your previous reply: "${message}", my question is...`);
    };

    const handleSend = async () => {
        if (!input.trim()) return setErrorMessage('Message cannot be empty.');

        setErrorMessage('');
        const newMessage = { sender: 'user', message: input.trim() };
        setChatHistory(prev => [...prev, newMessage]);
        setInput('');

        try {
            const response = await fetch('/api/translateToSQL', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput: newMessage.message, dbCredentials }),
            });
            const data = await response.json();

            setChatHistory(prev => [
                ...prev,
                { sender: 'bot', message: data.result || data.message || 'None', isSQL: !!data.result },
            ]);
        } catch (error) {
            console.error('Error generating SQL:', error);
            setChatHistory(prev => [...prev, { sender: 'bot', message: 'None' }]);
        }
    };

    const executeSQL = async (sqlQuery) => {
        if (!sqlQuery.trim()) return setChatHistory(prev => [...prev, { sender: 'bot', message: 'Invalid SQL query.' }]);

        try {
            const response = await fetch('/api/executeSQL', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dbCredentials, sqlQuery }),
            });
            const data = await response.json();

            if (response.ok && data?.success) {
                if (data.data) {
                    // Create a plain HTML table as a string
                    const tableHtml = `
                        <table class="table table-bordered table-hover mt-2">
                            <thead class="table-light">
                                <tr>${Object.keys(data.data[0] || {}).map((key) => `<th>${key}</th>`).join('')}</tr>
                            </thead>
                            <tbody>
                                ${data.data.map((row) => `
                                    <tr>
                                        ${Object.values(row).map((val) => `<td>${val}</td>`).join('')}
                                    </tr>`).join('')}
                            </tbody>
                        </table>`;

                    setChatHistory(prev => [
                        ...prev,
                        { sender: 'bot', message: tableHtml, isTable: true }
                    ]);
                } else {
                    setChatHistory(prev => [
                        ...prev,
                        { sender: 'bot', message: data.message || 'Execution successful.', isTable: false }
                    ]);
                }
            } else {
                setChatHistory(prev => [
                    ...prev,
                    { sender: 'bot', message: data.message || 'Execution failed.' }
                ]);
            }
        } catch (error) {
            console.error('SQL execution error:', error);
            setChatHistory(prev => [...prev, { sender: 'bot', message: 'None' }]);
        }
    };


    const handleClearHistory = () => {
        setChatHistory([{ sender: 'bot', message: 'How can I help you?' }]);
        localStorage.removeItem('chatHistory');
    };

    return (
        <div className={styles.container}>
            <div className={styles.chatHeader}>
                <h1 className='fs-4 mb-0 fw-semibold'>Chat with SQL</h1>
                <div className='d-flex justify-content-end align-items-center'>
                    <button type='button' className="btn btn-danger me-3 fw-semibold" onClick={handleClearHistory}><RiDeleteBin6Line /> History</button>
                    <AiOutlineSetting size={32} onClick={handleSettingsToggle} className={styles.settingsIcon} />
                </div>
            </div>

            <div className='container'>
                <div className={styles.chatBox}>
                    {chatHistory.map((chat, index) => (
                        <div key={index} className='d-flex flex-column'>
                            {chat.sender === 'user' ? (<small className="text-end">User</small>) : (<small>{chat.isSQL ? "Agent: SQL Command" : chat.isTable ? "Agent: SQL Table Result" : "Agent: SQL Response"}</small>)}
                            <div key={index} className={`${styles.chatMessage} ${chat.sender === 'user' ? styles.userMessage : styles.botMessage}`}>
                                {editingIndex === index ? (
                                    <textarea
                                        value={editInput}
                                        onChange={(e) => setEditInput(e.target.value)}
                                        rows={2}
                                        className={styles.editInput}
                                    />
                                ) : (
                                    chat.isTable ? (
                                        <div dangerouslySetInnerHTML={{ __html: chat.message }} />
                                    ) : (
                                        chat.message || 'None'
                                    )
                                )}

                                {chat.sender === 'bot' && chat.isSQL && (
                                    editingIndex === index ? (
                                        <button type='button' className="btn btn-primary ms-3" onClick={handleSaveEdit}>
                                            Save
                                        </button>
                                    ) : (
                                        <>
                                            <button type='button' className="btn btn-warning ms-3" onClick={() => handleEditMessage(index, chat.message)}>
                                                <RiEdit2Fill />
                                            </button>
                                            <button type='button' className="btn btn-success ms-3" onClick={() => executeSQL(chat.message)}>
                                                <FaGooglePlay />
                                            </button>
                                            <button type='button' className="btn btn-secondary ms-3" onClick={() => handleReply(chat.message)}>
                                                <FaReply />
                                            </button>
                                        </>
                                    )
                                )}
                            </div>

                        </div>
                    ))}
                    <div ref={endOfMessagesRef} />
                </div>

                <div className={styles.inputContainer}>
                    <div className={`d-flex align-item-center ${styles.inputContent}`}>
                        <textarea
                            className={`form-control ${styles.inputField}`}
                            placeholder="Type your message"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            rows={1}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        />
                        <div className='d-flex justify-content-between align-items-center px-3 gap-3'>
                            <small className='mb-0'><b>Developed</b> by <i>Teja Sundeep</i></small>
                            <button className="btn" onClick={handleSend}><BsArrowUpCircleFill /></button>
                        </div>
                    </div>
                    <p className='text-center mb-0 py-2 bg-white'><u>Note</u>: Check commands before running, errors may occur.</p>
                </div>
            </div>

            <div ref={modalRef} className={`modal fade ${isSettingsOpen ? 'show' : ''}`} tabIndex="-1" role="dialog" aria-labelledby="settingsModalLabel" aria-hidden={!isSettingsOpen} style={{ display: isSettingsOpen ? 'block' : 'none' }}>
                <div className="modal-dialog" role="document">
                    <div className="modal-content">
                        <div className="modal-header border-0 p-4">
                            <h5 className="modal-title" id="settingsModalLabel">Database Settings</h5>
                            <button type="button" className="btn-close" onClick={handleSettingsToggle} aria-label="Close"></button>
                        </div>
                        <div className="modal-body p-4 pt-0 pb-3">
                            {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}
                            {connectionMessage && <div className="alert alert-success">{connectionMessage}</div>}
                            <div>
                                <label htmlFor="host" className="fw-semibold">Host</label>
                                <input
                                    type="text"
                                    id="host"
                                    name="host"
                                    placeholder="Host"
                                    value={dbCredentials.host}
                                    onChange={handleChange}
                                    className="form-control mt-2 mb-3 py-2 px-3"
                                />

                                <label htmlFor="port" className="fw-semibold">Port</label>
                                <input
                                    type="text"
                                    id="port"
                                    name="port"
                                    placeholder="Port"
                                    value={dbCredentials.port}
                                    onChange={handleChange}
                                    className="form-control mt-2 mb-3 py-2 px-3"
                                />

                                <label htmlFor="user" className="fw-semibold">Username</label>
                                <input
                                    type="text"
                                    id="user"
                                    name="user"
                                    placeholder="User"
                                    value={dbCredentials.user}
                                    onChange={handleChange}
                                    className="form-control mt-2 mb-3 py-2 px-3"
                                />

                                <label htmlFor="password" className="fw-semibold">Password</label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    placeholder="Password"
                                    value={dbCredentials.password}
                                    onChange={handleChange}
                                    className="form-control mt-2 mb-3 py-2 px-3"
                                />

                                <label htmlFor="database" className="fw-semibold">Database Name</label>
                                <input
                                    type="text"
                                    id="database"
                                    name="database"
                                    placeholder="Database Name"
                                    value={dbCredentials.database}
                                    onChange={handleChange}
                                    className="form-control mt-2 mb-3 py-2 px-3"
                                />

                                <label htmlFor="dbType" className="fw-semibold">Database Type</label>
                                <select
                                    id="dbType"
                                    name="dbType"
                                    value={dbCredentials.dbType}
                                    onChange={handleChange}
                                    className="form-control mt-2 mb-3 py-2 px-3"
                                >
                                    <option value="postgres">PostgreSQL</option>
                                    <option value="mysql">MySQL</option>
                                    <option value="mssql">MSSQL</option>
                                </select>
                            </div>

                        </div>
                        <div className="modal-footer">
                            {!isConnected ? (
                                <button className="btn btn-primary" onClick={handleConnect}>Connect</button>
                            ) : (
                                <button className="btn btn-danger" onClick={handleDisconnect}>Disconnect</button>
                            )}
                            <button className="btn btn-secondary" onClick={handleSettingsToggle}>Close</button>
                        </div>
                    </div>
                </div>
            </div>
            {isSettingsOpen && <div className="modal-backdrop fade show"></div>}
        </div>
    );
}
