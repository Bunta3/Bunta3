
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { extractTextFromImage, generateResponseIdeas } from './services/geminiService';
import { type LoadingState, type LogEntry, type Tab, type Settings, type Persona } from './types';
import LoadingSpinner from './components/LoadingSpinner';
import { UploadIcon, CopyIcon, CheckIcon, ResetIcon, TrashIcon, ChevronDownIcon, ArrowUpTrayIcon, ChatBubbleLeftRightIcon, SparklesIcon, Cog6ToothIcon, ArrowPathIcon } from './components/Icons';

const LOG_STORAGE_KEY = 'ai-reply-assistant-logs';
const SETTINGS_STORAGE_KEY = 'ai-reply-assistant-settings';

const App: React.FC = () => {
    // Core state
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState<string>('');
    const [editedResponse, setEditedResponse] = useState<string>('');
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    
    // UI state
    const [activeTab, setActiveTab] = useState<Tab>('upload');

    // Text generation state
    const [textForGeneration, setTextForGeneration] = useState<string>('');
    const [suggestionsFromText, setSuggestionsFromText] = useState<string[]>([]);
    const [isGeneratingFromText, setIsGeneratingFromText] = useState<boolean>(false);
    const [selectedSuggestionFromText, setSelectedSuggestionFromText] = useState<string>('');
    const [editedResponseFromText, setEditedResponseFromText] = useState<string>('');
    const [copySuccessFromText, setCopySuccessFromText] = useState<boolean>(false);


    // Settings state
    const [settings, setSettings] = useState<Settings>({ minLength: 50, maxLength: 200, persona: 'polite' });

    // History state
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [activeLogId, setActiveLogId] = useState<string | null>(null);

    useEffect(() => {
        try {
            const savedLogs = localStorage.getItem(LOG_STORAGE_KEY);
            if (savedLogs) setLogs(JSON.parse(savedLogs));

            const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (savedSettings) setSettings(JSON.parse(savedSettings));
        } catch (e) {
            console.error("Failed to load data from localStorage", e);
        }
    }, []);

    const handleSettingsChange = (newSettings: Partial<Settings>) => {
        const updatedSettings = { ...settings, ...newSettings };
        setSettings(updatedSettings);
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) handleImageProcessing(file);
    };

    const handleImageProcessing = useCallback(async (file: File) => {
        resetState();
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError(null);
        
        try {
            setLoadingState('transcribing');
            const text = await extractTextFromImage(file);
            setExtractedText(text);

            setLoadingState('generating');
            const generated = await generateResponseIdeas(text, settings);
            setSuggestions(generated);

            if (generated.length > 0) {
                setSelectedSuggestion(generated[0]);
                setEditedResponse(generated[0]);
                setActiveTab('response');
            }
        } catch (err) {
            console.error(err);
            setError('処理中にエラーが発生しました。しばらくしてからもう一度お試しください。');
        } finally {
            setLoadingState('idle');
        }
    }, [settings]);

    const handleRegenerateFromImage = async () => {
        if (!extractedText) return;
        setError(null);
        setSuggestions([]);
        setLoadingState('generating');
        try {
            const generated = await generateResponseIdeas(extractedText, settings);
            setSuggestions(generated);
            if (generated.length > 0) {
                setSelectedSuggestion(generated[0]);
                setEditedResponse(generated[0]);
            }
        } catch (err) {
            console.error(err);
            setError('再生成中にエラーが発生しました。');
        } finally {
            setLoadingState('idle');
        }
    };

    const handleGenerateFromText = async () => {
        if (!textForGeneration.trim()) return;
        setError(null);
        setSuggestionsFromText([]);
        setIsGeneratingFromText(true);
        setSelectedSuggestionFromText('');
        setEditedResponseFromText('');
        setCopySuccessFromText(false);
        try {
            const generated = await generateResponseIdeas(textForGeneration, settings, extractedText);
            setSuggestionsFromText(generated);
            if (generated.length > 0) {
                setSelectedSuggestionFromText(generated[0]);
                setEditedResponseFromText(generated[0]);
            }
        } catch (err) {
            console.error(err);
            setError('生成中にエラーが発生しました。');
        } finally {
            setIsGeneratingFromText(false);
        }
    };

    const handleSuggestionSelect = (suggestion: string) => {
        setSelectedSuggestion(suggestion);
        setEditedResponse(suggestion);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSuggestionFromTextSelect = (suggestion: string) => {
        setSelectedSuggestionFromText(suggestion);
        setEditedResponseFromText(suggestion);
    
        // 編集セクションをビューポートの先頭にスクロール
        document.getElementById('text-generation-editor-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
        // すぐに編集できるようテキストエリアにフォーカス
        document.getElementById('text-gen-editor')?.focus();
    };

    const saveLog = (logData: Omit<LogEntry, 'id' | 'timestamp'>) => {
        const newLog: LogEntry = {
            id: new Date().toISOString(),
            timestamp: new Date().toLocaleString('ja-JP'),
            ...logData,
        };
        const updatedLogs = [newLog, ...logs];
        setLogs(updatedLogs);
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updatedLogs));
    };

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(editedResponse).then(() => {
            setCopySuccess(true);
            if (extractedText) {
                saveLog({
                    extractedText: extractedText,
                    suggestions: suggestions,
                    copiedResponse: editedResponse,
                });
            }
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const handleCopyToClipboardFromText = () => {
        if (!editedResponseFromText) return;
        navigator.clipboard.writeText(editedResponseFromText).then(() => {
            setCopySuccessFromText(true);
            const originalQuery = extractedText || textForGeneration;
            saveLog({
                extractedText: originalQuery,
                suggestions: suggestionsFromText,
                copiedResponse: editedResponseFromText,
            });
            setTimeout(() => setCopySuccessFromText(false), 2000);
        });
    };
    
    const handleClearLogs = () => {
        if (window.confirm('すべての履歴を削除しますか？')) {
            setLogs([]);
            localStorage.removeItem(LOG_STORAGE_KEY);
            setActiveLogId(null);
        }
    };

    const resetState = () => {
        setImageFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setExtractedText('');
        setSuggestions([]);
        setSelectedSuggestion('');
        setEditedResponse('');
        setLoadingState('idle');
        setError(null);
        setCopySuccess(false);
    };

    const loadingMessage = useMemo(() => {
        switch (loadingState) {
            case 'transcribing': return '画像を解析中...';
            case 'generating': return 'AIが返信案を作成中...';
            default: return '';
        }
    }, [loadingState]);

    const renderError = () => error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md my-4" role="alert">
            <p className="font-bold">エラー</p>
            <p>{error}</p>
        </div>
    );
    
    const personaOptions: { value: Persona; label: string }[] = [
        { value: 'polite', label: 'ていねい' },
        { value: 'casual', label: 'カジュアル' },
        { value: 'formal', label: 'フォーマル' },
        { value: 'gal', label: 'ギャル' },
        { value: 'osaka', label: '大阪弁' },
    ];

    const TabButton: React.FC<{ tab: Tab; icon: React.ReactNode; label: string }> = ({ tab, icon, label }) => (
        <button onClick={() => setActiveTab(tab)} className={`flex-1 flex flex-col items-center justify-center p-2 text-sm font-medium transition-colors duration-200 ${activeTab === tab ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>
            {icon}
            <span className="mt-1">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            <div className="w-full max-w-2xl mx-auto pb-24">
                <header className="text-center p-6 bg-white sticky top-0 z-10 shadow-sm">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">AI返信アシスタント</h1>
                </header>

                <main className="p-4 space-y-6">
                    {renderError()}

                    {activeTab === 'upload' && (
                        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-gray-700">1. 画像アップロード</h2>
                                {imageFile && (
                                    <button onClick={resetState} className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full bg-gray-100 hover:bg-red-100" aria-label="リセット">
                                        <ResetIcon />
                                    </button>
                                )}
                            </div>
                            <label htmlFor="file-upload" className="w-full cursor-pointer block">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 flex flex-col justify-center items-center min-h-[200px]">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="アップロードプレビュー" className="w-full h-auto object-contain rounded-md" />
                                    ) : (
                                        <>
                                            <UploadIcon />
                                            <p className="mt-2 text-gray-600">ここをタップして画像を選択</p>
                                            <p className="text-xs text-gray-500 mt-1">PNG, JPGなど</p>
                                        </>
                                    )}
                                </div>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                            </label>
                             {loadingState === 'transcribing' && <LoadingSpinner message={loadingMessage} />}
                        </div>
                    )}
                    
                    {activeTab === 'response' && (
                        <>
                         {loadingState === 'generating' && <LoadingSpinner message={loadingMessage}/>}
                         {!imageFile && !loadingState ? (
                            <div className="text-center text-gray-500 p-8 bg-white rounded-xl shadow-lg">
                                <p>まず「アップロード」タブから問い合わせ画像をアップロードしてください。</p>
                            </div>
                         ) : (
                         <>
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h2 className="text-xl font-semibold text-gray-700 mb-2">読み取られた内容</h2>
                                <p className="text-gray-800 whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded-md">{extractedText || '文字を読み取れませんでした。'}</p>
                            </div>

                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4">2. 返信を編集してコピー</h2>
                                <textarea value={editedResponse} onChange={(e) => setEditedResponse(e.target.value)} className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" placeholder="ここで返信内容を自由に編集できます..." aria-label="返信編集エリア" />
                                <div className="mt-4 flex justify-end">
                                    <button onClick={handleCopyToClipboard} className={`inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-colors duration-300 ${copySuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}>
                                        {copySuccess ? <CheckIcon/> : <CopyIcon/>}
                                        {copySuccess ? 'コピー完了！' : 'コピー'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <div className="flex justify-between items-center mb-4">
                                  <h2 className="text-xl font-semibold text-gray-700">3. 他の返信案</h2>
                                  <button onClick={handleRegenerateFromImage} disabled={loadingState === 'generating'} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium p-2 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <ArrowPathIcon className={loadingState === 'generating' ? 'animate-spin' : ''} />
                                    再生成
                                </button>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {suggestions.map((suggestion, index) => (
                                        <div key={index} onClick={() => handleSuggestionSelect(suggestion)} className={`p-4 rounded-lg cursor-pointer border-2 transition-all duration-200 ${selectedSuggestion === suggestion ? 'bg-blue-100 border-blue-500 shadow-md' : 'bg-gray-50 border-gray-200 hover:border-blue-400 hover:bg-white'}`}>
                                            <p className="text-gray-800 whitespace-pre-wrap">{suggestion}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         </>
                         )}
                        </>
                    )}

                    {activeTab === 'generate' && (
                        <div className="space-y-6">
                            {extractedText && (
                                <div className="bg-white rounded-xl shadow-lg p-6">
                                    <h2 className="text-xl font-semibold text-gray-700 mb-2">元の問い合わせ内容</h2>
                                    <p className="text-gray-800 whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded-md">{extractedText}</p>
                                </div>
                            )}
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4">テキストから返信案を生成</h2>
                                <p className="text-sm text-gray-500 mb-3">
                                    返信したい内容の骨子（要点）を入力してください。AIが元の問い合わせ内容と骨子を踏まえた丁寧な返信案を5つ作成します。
                                </p>
                                <textarea value={textForGeneration} onChange={e => setTextForGeneration(e.target.value)} className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="例：謝罪と、明日発送する旨を伝える"/>
                                <div className="mt-4 flex justify-end">
                                    <button onClick={handleGenerateFromText} disabled={isGeneratingFromText || !textForGeneration.trim()} className="flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                        <SparklesIcon className={isGeneratingFromText ? 'animate-spin' : ''} />
                                        {isGeneratingFromText ? '生成中...' : '生成する'}
                                    </button>
                                </div>
                            </div>
                            {isGeneratingFromText && <LoadingSpinner message="AIが返信案を作成中..." />}
                            {suggestionsFromText.length > 0 && (
                                <>
                                    <div 
                                        id="text-generation-editor-section"
                                        className="bg-white rounded-xl shadow-lg p-6"
                                        style={{ scrollMarginTop: '90px' }}
                                    >
                                        <h2 className="text-xl font-semibold text-gray-700 mb-4">返信を編集してコピー</h2>
                                        <textarea
                                            id="text-gen-editor"
                                            value={editedResponseFromText}
                                            onChange={(e) => setEditedResponseFromText(e.target.value)}
                                            className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                                            placeholder="下の候補を選択するか、直接編集してください"
                                            aria-label="テキスト生成からの返信編集エリア"
                                        />
                                        <div className="mt-4 flex justify-end">
                                            <button
                                                onClick={handleCopyToClipboardFromText}
                                                disabled={!editedResponseFromText}
                                                className={`inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-colors duration-300 ${copySuccessFromText ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {copySuccessFromText ? <CheckIcon /> : <CopyIcon />}
                                                {copySuccessFromText ? 'コピー完了！' : 'コピー'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-lg p-6">
                                        <h2 className="text-xl font-semibold text-gray-700 mb-4">生成された返信案</h2>
                                        <div className="grid grid-cols-1 gap-4">
                                            {suggestionsFromText.map((suggestion, index) => (
                                                <div 
                                                    key={index} 
                                                    onClick={() => handleSuggestionFromTextSelect(suggestion)} 
                                                    className={`p-4 rounded-lg cursor-pointer border-2 transition-all duration-200 ${selectedSuggestionFromText === suggestion ? 'bg-blue-100 border-blue-500 shadow-md' : 'bg-gray-50 border-gray-200 hover:border-blue-400 hover:bg-white'}`}
                                                >
                                                    <p className="text-gray-800 whitespace-pre-wrap">{suggestion}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                             <div className="bg-white rounded-xl shadow-lg p-6">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4">設定</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">回答のタイプ</label>
                                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {personaOptions.map(opt => (
                                                <label
                                                    key={opt.value}
                                                    htmlFor={`persona-${opt.value}`}
                                                    className={`relative flex items-center justify-start p-3 border rounded-lg cursor-pointer text-sm transition-colors duration-200 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 ${
                                                        settings.persona === opt.value
                                                            ? 'bg-blue-50 border-blue-500 text-blue-900'
                                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <input
                                                        id={`persona-${opt.value}`}
                                                        name="persona"
                                                        type="radio"
                                                        value={opt.value}
                                                        checked={settings.persona === opt.value}
                                                        onChange={e => handleSettingsChange({ persona: e.target.value as Persona })}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    />
                                                    <span className="ml-3 font-medium">{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">回答の文字数</label>
                                        <div className="flex items-center gap-4">
                                            <input type="number" value={settings.minLength} onChange={e => handleSettingsChange({ minLength: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-md" />
                                            <span>〜</span>
                                            <input type="number" value={settings.maxLength} onChange={e => handleSettingsChange({ maxLength: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-md" />
                                            <span>文字</span>
                                        </div>
                                    </div>
                                </div>
                             </div>

                             {logs.length > 0 && (
                                <div className="bg-white rounded-xl shadow-lg p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-xl font-semibold text-gray-700">操作履歴</h2>
                                        <button onClick={handleClearLogs} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 font-medium p-2 rounded-md hover:bg-red-50 transition-colors">
                                            <TrashIcon />
                                            履歴を消去
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {logs.map(log => (
                                            <div key={log.id} className="border border-gray-200 rounded-lg">
                                                <button onClick={() => setActiveLogId(activeLogId === log.id ? null : log.id)} className="w-full flex justify-between items-center p-3 text-left">
                                                    <span className="font-medium text-gray-700 text-sm">操作日時: {log.timestamp}</span>
                                                    <ChevronDownIcon className={`transform transition-transform ${activeLogId === log.id ? 'rotate-180' : ''}`} />
                                                </button>
                                                {activeLogId === log.id && (
                                                    <div className="p-4 border-t border-gray-200 bg-gray-50 text-sm">
                                                        <h4 className="font-semibold text-gray-600 mb-1">元の問い合わせ:</h4>
                                                        <p className="text-gray-800 whitespace-pre-wrap bg-white p-2 rounded border">{log.extractedText}</p>
                                                        <h4 className="font-semibold text-gray-600 mt-3 mb-1">コピーした返信:</h4>
                                                        <p className="text-gray-800 whitespace-pre-wrap bg-white p-2 rounded border">{log.copiedResponse}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 z-20">
              <div className="max-w-2xl mx-auto flex justify-around">
                  <TabButton tab="upload" icon={<ArrowUpTrayIcon />} label="アップロード" />
                  <TabButton tab="response" icon={<ChatBubbleLeftRightIcon />} label="AI返信案" />
                  <TabButton tab="generate" icon={<SparklesIcon />} label="テキスト生成" />
                  <TabButton tab="settings" icon={<Cog6ToothIcon />} label="設定" />
              </div>
            </nav>
        </div>
    );
};

export default App;
