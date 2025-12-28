
let isSendingMessage = false;
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';



// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import {
    signInAnonymously, signInWithCustomToken, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
    collection, query, orderBy, onSnapshot,
    addDoc, serverTimestamp, doc, updateDoc, getDocs, deleteDoc
} from 'firebase/firestore';

// --- Global Variable Setup (Mandatory for Canvas Environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyAlPvW2LBENz4ZJz2I9fZxfpi8H5-bASdY",
  authDomain: "open-ai-7b92d.firebaseapp.com",
  projectId: "open-ai-7b92d",
  storageBucket: "open-ai-7b92d.firebasestorage.app",
  messagingSenderId: "512071967882",
  appId: "1:512071967882:web:218060e148faaa95ff3973",
  measurementId: "G-ZR3X5Y16PG"
};

// The API endpoint and model for conversational generation
const MODEL_NAME = 'openai/gpt-4o-mini'; // Changed to a more reliable model (requires credits on OpenRouter)
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// --- I18N Text Mapping ---
const i18n = {
    en: {
        title: "Source AI",
        signOut: "Sign Out",
        newChat: "New Chat",
        history: "History",
        typeMessage: "Type your message here...",
        startConversation: "Start a new conversation",
        historySaved: "Your chat history is saved securely with Firestore.",
        welcome: "Welcome Back",
        createAccount: "Create Account",
        logIn: "Log In",
        signUp: "Sign Up",
        needAccount: "Need an account?",
        haveAccount: "Already have an account?",
        connecting: "Connecting to services...",
        authError: "Auth Error:",
        userID: "User ID:",
        loading: "Loading History...",
        darkMode: "Dark Mode",
        threadName: "New Chat",
        imagePlaceholder: "Attached an image. Describe or ask about it.",
        voicePrompt: "Please type your voice message (Simulated Transcription):",
    },
    hi: {
        title: "सौस चैट",
        signOut: "लॉग आउट करें",
        newChat: "नई चैट",
        history: "इतिहास",
        typeMessage: "अपना संदेश यहाँ लिखें...",
        startConversation: "एक नई बातचीत शुरू करें",
        historySaved: "आपकी चैट हिस्ट्री फायरस्टोर में सुरक्षित रूप से सेव है।",
        welcome: "आपका स्वागत है",
        createAccount: "खाता बनाएँ",
        logIn: "लॉग इन करें",
        signUp: "साइन अप करें",
        needAccount: "खाता चाहिए?",
        haveAccount: "पहले से खाता है?",
        connecting: "सेवाओं से जुड़ रहा है...",
        authError: "प्रमाणीकरण त्रुटि:",
        userID: "यूजर आईडी:",
        loading: "इतिहास लोड हो रहा है...",
        darkMode: "डार्क मोड",
        threadName: "नई चैट",
        imagePlaceholder: "फोटो अटैच है। इसके बारे में पूछें या बताएं।",
        voicePrompt: "कृपया अपना वॉइस मैसेज टाइप करें (सिम्युलेटेड ट्रांसक्रिप्शन):",
    },
    chg: {
        title: "सौस गोठबात", // Goṭhbāt (Conversation/Chat)
        signOut: "लोग आउट करव",
        newChat: "नवा गोठ करव",
        history: "इतिहास",
        typeMessage: "अपन गोठ इहाँ लिखव...",
        startConversation: "नवा गोठ शुरू करव",
        historySaved: "तोर गोठ इतिहास फायरस्टोर म सुरक्षित हे।",
        welcome: "फेर स्वागत हे",
        createAccount: "खाता बनाव",
        logIn: "लॉग इन करव",
        signUp: "साइन अप करव",
        needAccount: "खाता चाही?",
        haveAccount: "पहिली ले खाता हे?",
        connecting: "सेवा मन ले जुड़त हे...",
        authError: "परमानिक गलती:",
        userID: "उपयोगकर्ता आई.डी.:",
        loading: "इतिहास लोड होत हे...",
        darkMode: "अँधियारी मोड",
        threadName: "नवा गोठ",
        imagePlaceholder: "फोटो जोड़े गे हे. एकर बारे म पूछव या बताव.",
        voicePrompt: "कृपा करके अपन गोठ टाइप करव (नकली ट्रांसक्रिप्शन):",
    }
};

// Helper function for exponential backoff retry logic
const fetchWithBackoff = async (url, options, maxRetries = 3) => {
    let delay = 10000; // Start with 10 seconds
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            // For 429, retry after delay; for other errors, throw immediately
            throw new Error(`API returned status ${response.status}`);
        } catch (error) {
            if (!error.message.includes("429")) {
                throw error;
            }
            if (i === maxRetries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, 120000); // Cap at 2 minutes
        }
    }
    throw new Error("Max retries exceeded");
};

// Utility function to convert a File object to a Base64 string (data part only)
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result;
            // Extract the base64 data part (after the comma)
            resolve(result.split(',')[1]); 
        };
        reader.onerror = error => reject(error);
    });
};


// --- AuthScreen Component ---
const AuthScreen = ({ auth, setParentError, lang }) => {
    const texts = useMemo(() => i18n[lang] || i18n.en, [lang]);
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            console.error("Authentication Error:", error);
            if (error.code) {
                const message = error.code.replace('auth/', '').replace(/-/g, ' ');
                setAuthError(`${texts.authError} ${message}.`);
            } else {
                setAuthError("An unknown authentication error occurred.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700">
                <h2 className="text-3xl font-bold text-center text-indigo-600 mb-6">
                    {isLogin ? texts.welcome : texts.createAccount}
                </h2>

                {authError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4 rounded-lg" role="alert">
                        <p>{authError}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address"
                        required
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full p-3 rounded-lg text-white font-bold transition duration-200 shadow-md flex items-center justify-center
                            bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                        {loading ? (
                            <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.2"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : isLogin ? texts.logIn : texts.signUp}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    {isLogin ? texts.needAccount : texts.haveAccount}
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setAuthError(''); }}
                        className="ml-2 font-semibold text-indigo-600 hover:text-indigo-400 transition duration-150"
                    >
                        {isLogin ? texts.signUp : texts.logIn}
                    </button>
                </p>
            </div>
        </div>
    );
};

// --- ChatSidebar Component ---
const ChatSidebar = ({ isSidebarOpen, setIsSidebarOpen, threads, currentThreadId, switchThread, startNewThread, deleteThread, lang }) => {
    const texts = useMemo(() => i18n[lang] || i18n.en, [lang]);

    return (
        <>
            {/* Overlay for small screens */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-gray-900 bg-opacity-50 z-20 md:hidden" 
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}
            
            <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                            md:relative md:translate-x-0 w-64 bg-white dark:bg-gray-800 shadow-xl z-30 flex-shrink-0 
                            transition-transform duration-300 flex flex-col border-r dark:border-gray-700`}>
                
                {/* Header and Close Button (Mobile Only) */}
                <div className="p-4 flex justify-between items-center border-b dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{texts.history}</h3>
                    <button 
                        onClick={() => setIsSidebarOpen(false)} 
                        className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                        aria-label="Close History"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-4 border-b dark:border-gray-700">
                    <button 
                        onClick={startNewThread} 
                        className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-150 flex items-center justify-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        {texts.newChat}
                    </button>
                </div>

                {/* Thread List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {threads.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 p-2">{texts.startConversation}</p>
                    ) : (
                        threads.map(thread => (
                            <div
                                key={thread.id}
                                className={`flex justify-between items-center p-3 rounded-lg transition duration-150 ${
                                    thread.id === currentThreadId
                                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-bold'
                                        : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <button
                                    onClick={() => switchThread(thread.id)}
                                    className="flex-1 text-left truncate"
                                    title={thread.name}
                                >
                                    {thread.name}
                                    <span className="block text-xs opacity-75">{new Date(thread.createdAt).toLocaleDateString()}</span>
                                </button>
                                <button
                                    onClick={() => deleteThread(thread.id)}
                                    className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    title="Delete Chat"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};


/**
 * Main application component for the AI Chatbot.
 */
const App = () => {
    // --- UI/Theming States ---
    const [language, setLanguage] = useState('en'); // Default language is English
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // --- Firebase States ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // --- Chat States ---
    const [threads, setThreads] = useState([]); // List of chat threads
    const [currentThreadId, setCurrentThreadId] = useState(null); // ID of the currently active thread
    const [messages, setMessages] = useState([]); // Messages of the current thread
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    
    // --- Multimodal State ---
    const [selectedImageBase64, setSelectedImageBase64] = useState(null);
    const imageFileInputRef = useRef(null);

    const messagesEndRef = useRef(null);
    const texts = useMemo(() => i18n[language] || i18n.en, [language]);

    // Apply dark mode class to HTML body
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // --- Firebase Initialization and Authentication ---
    useEffect(() => {
        let unsubscribeAuth = () => {};

        try {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            setDb(db);
            setAuth(auth);

            unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAnonymous(user.isAnonymous);
                } else {
                    if (initialAuthToken) {
                        try {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } catch (e) {
                            console.error("Firebase Auth Error (Token):", e);
                            setError("Failed to authenticate with custom token.");
                        }
                    } else {
                        setUserId(null);
                    }
                }
                setIsAuthReady(true);
            });

        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setError("Failed to initialize Firebase services.");
            setIsAuthReady(true);
        }

        return () => unsubscribeAuth();
    }, []);

    // --- Sign Out Handler ---
    const handleSignOut = async () => {
        if (auth) {
            try {
                setMessages([]);
                setThreads([]);
                setCurrentThreadId(null);
                setSelectedImageBase64(null); // Clear image state
                setUserId(null);
                await signOut(auth);
                console.log("Signed out successfully. Showing login screen.");
            } catch (e) {
                console.error("Sign Out Error:", e);
                setError("Failed to sign out.");
            }
        }
    };

    // --- Firestore THREADS Listener ---
    useEffect(() => {
        if (!isAuthReady || !db || !userId) {
            setThreads([]);
            return;
        }

        const threadsCollectionPath = `artifacts/${appId}/users/${userId}/threads`;
        const threadsCollectionRef = collection(db, threadsCollectionPath);
        
        const q = query(threadsCollectionRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const threadList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toMillis() || Date.now(),
            }));
            
            setThreads(threadList);

            if (threadList.length > 0 && !currentThreadId) {
                setCurrentThreadId(threadList[0].id);
            } else if (threadList.length === 0) {
                setCurrentThreadId(null);
                setMessages([]);
            }
        }, (err) => {
            console.error("Firestore Threads Snapshot Error:", err);
            setError("Failed to load chat threads.");
        });

        return () => unsubscribe();
    }, [isAuthReady, db, userId, currentThreadId]);

    // --- Firestore MESSAGES Listener ---
    useEffect(() => {
        if (!isAuthReady || !db || !userId || !currentThreadId) {
            setMessages([]);
            return;
        }

        const messagesCollectionPath = `artifacts/${appId}/users/${userId}/threads/${currentThreadId}/messages`;
        const messagesCollectionRef = collection(db, messagesCollectionPath);
        
        const q = query(messagesCollectionRef, orderBy('timestamp'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toMillis(),
            }));
            setMessages(chatMessages);
            setTimeout(scrollToBottom, 100);
        }, (err) => {
            console.error("Firestore Messages Snapshot Error:", err);
            setError("Failed to load current chat messages.");
        });

        return () => unsubscribe();
    }, [isAuthReady, db, userId, currentThreadId]);

    // --- Thread Management ---
    const startNewThread = async () => {
        if (!db || !userId) return;
        setIsSidebarOpen(false);
        setSelectedImageBase64(null);
        setInput('');
        try {
            const threadsCollectionPath = `artifacts/${appId}/users/${userId}/threads`;
            const newThreadRef = await addDoc(collection(db, threadsCollectionPath), {
                name: "Source AI",
                createdAt: serverTimestamp(),
            });
            setCurrentThreadId(newThreadRef.id);
            setMessages([]);
        } catch (e) {
            console.error("Error starting new thread:", e);
            setError("Could not start a new chat thread.");
        }
    };

    const switchThread = (threadId) => {
        setCurrentThreadId(threadId);
        setIsSidebarOpen(false);
        setMessages([]);
        setSelectedImageBase64(null); // Clear image state on thread switch
        setInput('');
    };

    const deleteThread = async (threadId) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this chat permanently?");
        if (!confirmDelete) return;
        if (!db || !userId) return;
        try {
            // First, delete all messages in the thread
            const messagesRef = collection(db, `artifacts/${appId}/users/${userId}/threads/${threadId}/messages`);
            const messagesSnapshot = await getDocs(messagesRef);
            const deletePromises = messagesSnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
            await Promise.all(deletePromises);
            // Then delete the thread document
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/threads`, threadId));
            // If the deleted thread was current, reset
            if (currentThreadId === threadId) {
                setCurrentThreadId(null);
                setMessages([]);
            }
        } catch (e) {
            console.error("Error deleting thread:", e);
            setError("Could not delete the chat thread.");
        }
    };

    const deleteMessage = async (messageId) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this message?");
        if (!confirmDelete) return;
        if (!db || !userId || !currentThreadId) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/threads/${currentThreadId}/messages`, messageId));
        } catch (e) {
            console.error("Error deleting message:", e);
            setError("Could not delete the message.");
        }
    };
    
    // --- File/Voice Handlers ---

    // Handles the file selection via the hidden input
    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            fileToBase64(file).then(base64 => {
                setSelectedImageBase64(base64);
                // Set placeholder text for user's query if input is empty
                if (!input.trim()) setInput(texts.imagePlaceholder);
            }).catch(err => {
                console.error("Image conversion failed:", err);
                setSelectedImageBase64(null);
                setError("Failed to process image file.");
            });
        }
        // Reset the file input value to allow selecting the same file again
        e.target.value = null;
    };

    // Simulates voice input via a text prompt
    const handleVoiceShare = () => {
        const voiceText = prompt(texts.voicePrompt);
        if (voiceText) {
            setInput(voiceText);
            setSelectedImageBase64(null); // Clear image if voice is used
        }
    };


    // --- Chat Logic: Sending message and calling Gemini API ---

    // Function to save a message (user or model) to Firestore
    const saveMessageToFirestore = useCallback(async (role, text, threadId, imageData = null) => {
        if (!db || !userId || !threadId) return;
        try {
            const messagesCollectionPath = `artifacts/${appId}/users/${userId}/threads/${threadId}/messages`;
            await addDoc(collection(db, messagesCollectionPath), {
                role,
                text,
                timestamp: serverTimestamp(),
                // Save the image data (Base64) with the user message
                imageData: imageData, 
            });
            // Update the thread's last activity/name if it's the first message
            if (messages.length === 0 && role === 'user') {
                 const threadRef = doc(db, `artifacts/${appId}/users/${userId}/threads`, threadId);
                 await updateDoc(threadRef, {
                    name: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
                    lastActivity: serverTimestamp(),
                 });
            }
        } catch (e) {
            console.error("Error adding document to Firestore:", e);
            setError("Could not save message history.");
        }
    }, [db, userId, messages.length]);


    const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();

    // 🔥 Prevent duplicate requests (Main 429 Fix)
    if (isSendingMessage) {
        console.warn("Duplicate send stopped.");
        return;
    }
    isSendingMessage = true;

    const textToSend = input.trim();
    const imageBase64ToSend = selectedImageBase64;

    if ((!textToSend && !imageBase64ToSend) || isLoading) {
        isSendingMessage = false;
        return;
    }

    let activeThreadId = currentThreadId;

    // Create thread if none exists
    if (!activeThreadId) {
        const threadsCollectionPath = `artifacts/${appId}/users/${userId}/threads`;
        const newThreadRef = await addDoc(collection(db, threadsCollectionPath), {
            name: "Source AI",
            createdAt: serverTimestamp(),
        });
        activeThreadId = newThreadRef.id;
        setCurrentThreadId(activeThreadId);
    }

    setInput('');
    setSelectedImageBase64(null);
    setIsLoading(true);
    setError(null);

    await saveMessageToFirestore('user', textToSend, activeThreadId, imageBase64ToSend);

    try {
        const chatHistoryForAPI = messages.map(m => {
            let content = m.text;

            if (m.imageData) {
                content = [
                    { type: 'text', text: m.text },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.imageData}` } }
                ];
            }
            return {
                role: m.role === 'model' ? 'assistant' : 'user',
                content
            };
        });

        let newUserContent = textToSend;
        if (imageBase64ToSend) {
            newUserContent = [
                { type: 'text', text: textToSend },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64ToSend}` } }
            ];
        }

        chatHistoryForAPI.push({
            role: 'user',
            content: newUserContent
        });

        const payload = {
            model: MODEL_NAME,
            messages: [
                { role: 'system', content: 'You are a friendly, helpful AI assistant.' },
                ...chatHistoryForAPI
            ]
        };

        const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;

        const response = await fetchWithBackoff(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response || !response.ok) {
            throw new Error("API failed, status: " + (response?.status || "NO_RESPONSE"));
        }

        const result = await response.json();
        const modelText = result.choices?.[0]?.message?.content || "No response.";

        await saveMessageToFirestore("model", modelText, activeThreadId);

    } catch (err) {
        console.error("API Error:", err);
        setError(err.message.includes("429") 
            ? "Rate limit exceeded. Try again later." 
            : "Failed to communicate with AI."
        );
    }

    isSendingMessage = false;
    setIsLoading(false);

}, [input, selectedImageBase64, isLoading, messages, db, userId, currentThreadId, saveMessageToFirestore]);

    // --- UI Rendering ---

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
                <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl shadow-lg" role="alert">
                    <strong className="font-bold">{texts.authError.replace(':', '')}:</strong>
                    <span className="block sm:inline ml-2">{error}</span>
                    <p className="text-sm mt-2">Please check the console for details.</p>
                </div>
            </div>
        );
    }

    if (!isAuthReady || !auth) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
                <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.2"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-gray-600 dark:text-gray-400">{texts.connecting}</p>
            </div>
        );
    }

    if (!userId) {
        return <AuthScreen auth={auth} setParentError={setError} lang={language} />;
    }

    if (isAnonymous && messageCount >= 2 && !hasPrompted) {
        setShowAuthPrompt(true);
        setHasPrompted(true);
    }

    if (showAuthPrompt) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
                <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-center text-indigo-600 mb-4">Continue Chatting</h2>
                    <p className="text-center mb-6">You've sent a few messages. Log in or sign up to save your chats and continue chatting.</p>
                    <div className="space-y-4">
                        <button
                            onClick={() => setShowAuthPrompt(false)}
                            className="w-full p-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition"
                        >
                            Continue as Guest
                        </button>
                        {showAuthPrompt && (
                            <p className="text-center text-sm text-gray-500 mt-2">You can sign up anytime from the header.</p>
                        )}
                        <div className="text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Or create an account:</p>
                        </div>
                        <AuthScreen auth={auth} setParentError={setError} lang={language} />
                    </div>
                </div>
            </div>
        );
    }

    const hasMessages = messages.length > 0;
    const currentThreadName = threads.find(t => t.id === currentThreadId)?.name || texts.title;

    return (
        <div className="flex h-screen antialiased text-gray-800 bg-gray-50 dark:bg-gray-900 font-sans transition-colors">
            
            {/* Sidebar */}
            <ChatSidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                threads={threads}
                currentThreadId={currentThreadId}
                switchThread={switchThread}
                startNewThread={startNewThread}
                deleteThread={deleteThread}
                lang={language}
            />

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'md:ml-0' : 'md:ml-0'}`}>
                
                {/* Header */}
                <header className="p-4 bg-white dark:bg-gray-800 shadow-md flex justify-between items-center sticky top-0 z-10 border-b dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                        {/* Menu/Open Sidebar Button (Mobile) */}
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 md:hidden text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                            aria-label="Open History"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                        </button>

                        <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[200px] sm:max-w-none">
                             <span className="inline-block align-middle mr-2">💡</span>
                             Source AI
                         </h1>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        {/* Language Selector */}
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 p-2 rounded-lg text-sm transition"
                        >
                            <option value="en">English</option>
                            <option value="hi">Hindi</option>
                            <option value="chg">Chhattisgarhi</option>
                        </select>

                        {/* Dark Mode Toggle */}
                        <button
                            onClick={() => setIsDarkMode(prev => !prev)}
                            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                            aria-label={texts.darkMode}
                        >
                            {isDarkMode ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.293 13.903A8.983 8.983 0 0110 18c-4.418 0-8-3.582-8-8 0-2.316.98-4.407 2.56-5.875A9.001 9.001 0 0017.293 13.903z"></path></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.356 2.644a1 1 0 10-1.412 1.412l.706.706a1 1 0 001.412-1.412l-.706-.706zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-4.356 5.356a1 1 0 10-1.412-1.412l-.706.706a1 1 0 101.412 1.412l.706-.706zM10 16a1 1 0 100-2 1 1 0 000 2zM5.644 14.356a1 1 0 101.412-1.412l-.706-.706a1 1 0 00-1.412 1.412l.706.706zM4 11a1 1 0 100-2H3a1 1 0 100 2h1zm3.356-5.356a1 1 0 10-1.412 1.412l-.706-.706a1 1 0 101.412-1.412l.706.706z"></path></svg>
                            )}
                        </button>

                        {/* User/Sign Out */}
                        {userId && (
                            <div className="hidden sm:flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {texts.userID} {userId}
                                </span>
                                <button
                                    onClick={handleSignOut}
                                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg text-sm transition duration-150 shadow-md"
                                >
                                    {texts.signOut}
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                {/* Chat Messages Area */}
                <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 dark:bg-gray-900 transition-colors">
                    {(!hasMessages && currentThreadId) ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 mt-10">
                            <svg className="w-12 h-12 text-indigo-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{texts.startConversation}</h2>
                            <p className="text-gray-500 dark:text-gray-400">{texts.historySaved}</p>
                        </div>
                    ) : (!currentThreadId && threads.length === 0) ? (
                         <div className="flex flex-col items-center justify-center h-full text-center p-6 mt-10">
                            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300">Welcome to Source AI</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">Use the '{texts.newChat}' button to begin your first conversation.</p>
                        </div>
                    ) : (
                         messages.map((message) => (
                             <div
                                 key={message.id}
                                 className={`flex group ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                             >
                                 <div
                                     className={`max-w-[75%] p-3 rounded-xl shadow-md relative ${
                                         message.role === 'user'
                                             ? 'bg-indigo-600 text-white rounded-br-none'
                                             : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-200 dark:border-gray-600'
                                     }`}
                                 >
                                     {/* Delete Button */}
                                     <button
                                         onClick={() => deleteMessage(message.id)}
                                         className={`absolute top-1 ${message.role === 'user' ? 'left-1' : 'right-1'} text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity`}
                                         title="Delete Message"
                                     >
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                         </svg>
                                     </button>
                                     {/* Display attached image if present */}
                                     {message.role === 'user' && message.imageData && (
                                         <div className="mb-2 p-1 border border-indigo-200 dark:border-indigo-900 rounded-lg bg-indigo-50 dark:bg-gray-600">
                                             <img
                                                 src={`data:image/jpeg;base64,${message.imageData}`}
                                                 alt="Attached media"
                                                 className="max-w-full h-auto rounded-md shadow-inner"
                                                 style={{ maxHeight: '200px', objectFit: 'contain' }}
                                             />
                                         </div>
                                     )}
                                     <p className="whitespace-pre-wrap">{message.text}</p>
                                 </div>
                             </div>
                         ))
                    )}

                    {/* Loading Indicator for Model's Response */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="max-w-3/4 p-3 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-200 dark:border-gray-600 shadow-md">
                                <div className="flex space-x-1">
                                    <span className="animate-bounce inline-block w-2 h-2 bg-indigo-400 rounded-full"></span>
                                    <span className="animate-bounce inline-block w-2 h-2 bg-indigo-400 rounded-full" style={{ animationDelay: '0.2s' }}></span>
                                    <span className="animate-bounce inline-block w-2 h-2 bg-indigo-400 rounded-full" style={{ animationDelay: '0.4s' }}></span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scroll Anchor */}
                    <div ref={messagesEndRef} />
                </main>

                {/* Input Area (Fixed Footer) */}
                <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-xl transition-colors">
                    <form onSubmit={handleSendMessage} className="flex items-end space-x-3 max-w-4xl mx-auto">
                        
                        {/* Hidden File Input */}
                        <input
                            type="file"
                            accept="image/jpeg, image/png, image/jpg"
                            ref={imageFileInputRef}
                            onChange={handleImageSelect}
                            style={{ display: 'none' }}
                        />

                        {/* Attachment Button */}
                        <button
                            type="button"
                            onClick={() => imageFileInputRef.current.click()}
                            className="p-3 rounded-xl text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-150 shadow-md self-end"
                            aria-label="Attach File (Image)"
                            title="Attach Image"
                            disabled={isLoading}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L15 15m0 0l-1.586-1.586a2 2 0 00-2.828 0L6 18m2-7H4m4 0h6m-3-4V4a2 2 0 012-2h4a2 2 0 012 2v4"></path></svg>
                        </button>
                        
                        {/* Voice Share Button (Simulated) */}
                        <button
                            type="button"
                            onClick={handleVoiceShare}
                            className="p-3 rounded-xl text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-150 shadow-md self-end"
                            aria-label="Voice Share (Simulated)"
                            title="Voice Share (Simulated)"
                            disabled={isLoading}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        </button>

                        {/* Text Input */}
                        <div className="flex-1 relative">
                             {selectedImageBase64 && (
                                <div className="absolute top-[-10px] left-0 text-xs px-2 py-1 bg-indigo-500 text-white rounded-full shadow-lg z-10 -translate-y-full flex items-center space-x-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L15 15m0 0l-1.586-1.586a2 2 0 00-2.828 0L6 18m2-7H4m4 0h6m-3-4V4a2 2 0 012-2h4a2 2 0 012 2v4"></path></svg>
                                    <span>Image Attached (Ready to Send)</span>
                                </div>
                            )}
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={texts.typeMessage}
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-inner"
                                disabled={isLoading}
                            />
                        </div>

                         {/* Send Button */}
                         <button
                             type="submit"
                             disabled={(!input.trim() && !selectedImageBase64) || isLoading}
                             className={`p-3 rounded-xl text-white font-semibold transition duration-200 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300`}
                         >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                         </button>
                     </form>
                 </div>
             </div>
         </div>
     );
 };

export default App;