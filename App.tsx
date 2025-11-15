

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Device, ArchivedDevice, Note, ChangeLog, Tab, ModalType, CertificateAnalysisResult } from './types';
import { INITIAL_DEVICES, COLUMNS, ARCHIVE_COLUMNS, INITIAL_PASSWORD, PASSWORD_RECOVERY_ANSWER } from './constants';
import { Icon, ChevronDown, ChevronUp, ChevronsUpDown, Search, FileDown, FileUp, Plus, Edit, Archive, Settings, Sun, Moon, X, AlertTriangle, CheckCircle, FileText, Bot, MoreVertical, Filter } from './components/Icon';
import { Modal } from './components/Modal';
import { importFromExcel, exportToExcel } from './services/excelService';
import { analyzeCertificateWithGemini } from './services/geminiService';
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.394/build/pdf.worker.mjs`;


// Helper components defined outside the main App component to avoid re-creation on re-renders

const Header: React.FC<{
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    onSettingsClick: () => void;
}> = ({ theme, toggleTheme, onSettingsClick }) => (
    <header className="bg-card dark:bg-dark-card border-b border-border dark:border-dark-border p-4 flex justify-between items-center sticky top-0 z-40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
            <Icon icon={FileText} className="text-primary-500 w-8 h-8" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground dark:text-dark-foreground">Lab Envanter Pro</h1>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-accent dark:hover:bg-dark-accent transition-colors">
                <Icon icon={theme === 'light' ? Moon : Sun} className="w-6 h-6" />
            </button>
            <button onClick={onSettingsClick} className="p-2 rounded-full hover:bg-accent dark:hover:bg-dark-accent transition-colors">
                <Icon icon={Settings} className="w-6 h-6" />
            </button>
        </div>
    </header>
);

const TabsComponent: React.FC<{ activeTab: Tab; setActiveTab: (tab: Tab) => void }> = ({ activeTab, setActiveTab }) => {
    const tabs: { id: Tab; label: string }[] = [
        { id: 'inventory', label: 'Envanter Yönetimi' },
        { id: 'analysis', label: 'Sertifika Analiz Aracı' }
    ];

    return (
        <div className="border-b border-border dark:border-dark-border px-4">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`${tab.id === activeTab
                            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted dark:hover:text-dark-foreground dark:hover:border-dark-muted'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
        </div>
    );
};

const useInventory = () => {
    const [devices, setDevices] = useState<Device[]>(() => {
        const saved = localStorage.getItem('devices');
        return saved ? JSON.parse(saved) : INITIAL_DEVICES;
    });
    const [archived, setArchived] = useState<ArchivedDevice[]>(() => {
        const saved = localStorage.getItem('archived');
        return saved ? JSON.parse(saved) : [];
    });
    const [notes, setNotes] = useState<Record<number, Note[]>>(() => {
        const saved = localStorage.getItem('notes');
        return saved ? JSON.parse(saved) : {};
    });
    const [changeLogs, setChangeLogs] = useState<Record<number, ChangeLog[]>>(() => {
        const saved = localStorage.getItem('changeLogs');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => { localStorage.setItem('devices', JSON.stringify(devices)); }, [devices]);
    useEffect(() => { localStorage.setItem('archived', JSON.stringify(archived)); }, [archived]);
    useEffect(() => { localStorage.setItem('notes', JSON.stringify(notes)); }, [notes]);
    useEffect(() => { localStorage.setItem('changeLogs', JSON.stringify(changeLogs)); }, [changeLogs]);
    
    const addDevice = (device: Omit<Device, 'ID' | 'Aktif'>) => {
        setDevices(prev => [...prev, { ...device, ID: Date.now(), Aktif: 'Evet' }]);
    };
    
    const updateDevice = (updatedDevice: Device) => {
        const oldDevice = devices.find(d => d.ID === updatedDevice.ID);
        if(!oldDevice) return;

        const changes: ChangeLog[] = [];
        for (const key in updatedDevice) {
            if (key !== 'ID' && oldDevice[key as keyof Device] !== updatedDevice[key as keyof Device]) {
                changes.push({
                    alan: key,
                    eski: String(oldDevice[key as keyof Device]),
                    yeni: String(updatedDevice[key as keyof Device]),
                    tarih: new Date().toISOString(),
                });
            }
        }
        if(changes.length > 0) {
            setChangeLogs(prev => ({ ...prev, [updatedDevice.ID]: [...(prev[updatedDevice.ID] || []), ...changes] }));
        }

        setDevices(prev => prev.map(d => d.ID === updatedDevice.ID ? updatedDevice : d));
    };

    const archiveDevice = (deviceId: number) => {
        const deviceToArchive = devices.find(d => d.ID === deviceId);
        if (!deviceToArchive) return;
        
        const archivedDevice: ArchivedDevice = {
            ...deviceToArchive,
            'Arşivlenme Tarihi': new Date().toISOString(),
        };

        setArchived(prev => [...prev, archivedDevice]);
        setDevices(prev => prev.filter(d => d.ID !== deviceId));
    };

    const restoreDevice = (deviceId: number) => {
        const deviceToRestore = archived.find(d => d.ID === deviceId);
        if (!deviceToRestore) return;

        const { 'Arşivlenme Tarihi': _, ...restoredDevice } = deviceToRestore;
        
        setDevices(prev => [...prev, restoredDevice as Device]);
        setArchived(prev => prev.filter(a => a.ID !== deviceId));
    };

    const addNoteForDevice = (deviceId: number, text: string) => {
        const newNote: Note = {
            ID: Date.now(),
            not_metni: text,
            tarih: new Date().toISOString()
        };
        setNotes(prev => ({...prev, [deviceId]: [...(prev[deviceId] || []), newNote]}));
    };
    
    const deleteNoteById = (deviceId: number, noteId: number) => {
        setNotes(prev => ({
            ...prev,
            [deviceId]: (prev[deviceId] || []).filter(n => n.ID !== noteId)
        }));
    };


    return { devices, setDevices, archived, addDevice, updateDevice, archiveDevice, restoreDevice, notes, changeLogs, addNoteForDevice, deleteNoteById };
};

const useAuth = () => {
    const getPassword = () => localStorage.getItem('admin_password') || INITIAL_PASSWORD;
    const [password, setPassword] = useState(getPassword);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const checkPassword = (input: string) => {
        if (input === password) {
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const changePassword = (oldPass: string, newPass: string) => {
        if(oldPass === password) {
            localStorage.setItem('admin_password', newPass);
            setPassword(newPass);
            return true;
        }
        return false;
    };
    
    const recoverPassword = (answer: string) => {
        if(answer.toLowerCase() === PASSWORD_RECOVERY_ANSWER.toLowerCase()) {
            localStorage.setItem('admin_password', INITIAL_PASSWORD);
            setPassword(INITIAL_PASSWORD);
            return true;
        }
        return false;
    };


    const withAuth = (action: () => void) => {
        if (isAuthenticated) {
            action();
        } else {
            return new Promise<string>((resolve) => {
                // In a real app, this would trigger a modal and resolve with the password
                // For this structure, the modal will handle this logic.
                // This is a simplified placeholder.
                const pass = prompt('Yönetici parolasını girin:');
                if(pass) resolve(pass);
            }).then(pass => {
                if (checkPassword(pass)) {
                    action();
                } else {
                    alert('Parola hatalı.');
                }
            });
        }
    };

    return { checkPassword, withAuth, changePassword, recoverPassword, setIsAuthenticated };
};

const PasswordPromptModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    checkPassword: (pass: string) => boolean;
}> = ({ isOpen, onClose, onSuccess, checkPassword }) => {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (checkPassword(input)) {
            setError('');
            setInput('');
            onSuccess();
        } else {
            setError('Parola hatalı.');
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Yönetici Doğrulama">
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Bu işlem için yönetici parolası gereklidir.</p>
                <input
                    type="password"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="w-full px-3 py-2 bg-background dark:bg-dark-background border border-input dark:border-dark-input rounded-md focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Parola"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground rounded-md hover:bg-accent dark:hover:bg-dark-accent">İptal</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-primary dark:bg-dark-primary text-primary-foreground dark:text-dark-primary-foreground rounded-md hover:bg-primary-700 dark:hover:bg-primary-600">Onayla</button>
                </div>
            </div>
        </Modal>
    );
};

// Main App Component
export default function App() {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
    const [activeTab, setActiveTab] = useState<Tab>('inventory');
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [selectedDeviceForModal, setSelectedDeviceForModal] = useState<Device | null>(null);
    const [actionToConfirm, setActionToConfirm] = useState<(() => void) | null>(null);
    
    const inventory = useInventory();
    const auth = useAuth();
    
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

    const handleAuthenticatedAction = (action: () => void) => {
        setActionToConfirm(() => action);
        setActiveModal('password');
    };

    const handleAddClick = () => {
        setSelectedDeviceForModal(null);
        setActiveModal('addDevice');
    };

    const handleEditClick = (device: Device) => {
        setSelectedDeviceForModal(device);
        setActiveModal('editDevice');
    };

    const handleAuthenticatedEditClick = (device: Device) => {
        handleAuthenticatedAction(() => handleEditClick(device));
    };
    
    const handleAuthenticatedArchiveClick = (deviceId: number) => {
        handleAuthenticatedAction(() => {
            inventory.archiveDevice(deviceId);
        });
    };

    const handlePasswordSuccess = () => {
        auth.setIsAuthenticated(true);
        if (actionToConfirm) {
            actionToConfirm();
        }
        setActiveModal(null);
        setActionToConfirm(null);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'inventory':
                return <InventoryView inventory={inventory} onEdit={handleEditClick} onAuthenticatedEdit={handleAuthenticatedEditClick} onArchive={handleAuthenticatedArchiveClick} onAdd={handleAddClick} />;
            case 'analysis':
                return <AnalysisView />;
            default:
                return null;
        }
    };
    
    const DeviceFormModal: React.FC = () => {
        const isEditing = activeModal === 'editDevice';
        const [formData, setFormData] = useState<Partial<Device>>({});

        useEffect(() => {
            if (activeModal === 'addDevice' || activeModal === 'editDevice') {
                const initialData: Partial<Device> = isEditing && selectedDeviceForModal 
                    ? selectedDeviceForModal 
                    : { Ekipman: '', 'Birim Kodu': '', Birim: '', Model: '', 'Seri No': '', 'Kalibrasyon Tarihi': new Date().toISOString().split('T')[0], 'Kalibrasyon Periyodu (ay)': 12, 'Son Kalibrasyon': '', Durum: 'Çalışıyor', Aktif: 'Evet' };
                setFormData(initialData);
            }
        }, [activeModal, selectedDeviceForModal, isEditing]);


        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (isEditing && selectedDeviceForModal) {
                inventory.updateDevice(formData as Device);
            } else {
                inventory.addDevice(formData as Omit<Device, 'ID' | 'Aktif'>);
            }
            setActiveModal(null);
            setSelectedDeviceForModal(null);
        };
        
        return (
            <Modal isOpen={activeModal === 'addDevice' || activeModal === 'editDevice'} onClose={() => setActiveModal(null)} title={isEditing ? 'Cihazı Düzenle' : 'Yeni Cihaz Ekle'}>
                 <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                    {COLUMNS.filter(c => c !== 'ID' && c !== 'Aktif').map(col => (
                        <div key={col}>
                            <label className="block text-sm font-medium text-foreground dark:text-dark-foreground">{col}</label>
                            <input
                                type={col.includes('Tarih') ? 'date' : col.includes('(ay)') ? 'number' : 'text'}
                                name={col}
                                value={(formData as any)[col] || ''}
                                onChange={handleChange}
                                required={['Ekipman', 'Seri No'].includes(col)}
                                className="mt-1 block w-full px-3 py-2 bg-background dark:bg-dark-background border border-input dark:border-dark-input rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            />
                        </div>
                    ))}
                     <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 bg-secondary dark:bg-dark-secondary rounded-md hover:bg-accent dark:hover:bg-dark-accent">İptal</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">Kaydet</button>
                    </div>
                 </form>
            </Modal>
        );
    };
    
    const SettingsModal: React.FC = () => {
        const [oldPass, setOldPass] = useState('');
        const [newPass, setNewPass] = useState('');
        const [recovery, setRecovery] = useState('');
        const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

        const handlePassChange = () => {
            if(auth.changePassword(oldPass, newPass)) {
                setMessage({type: 'success', text: 'Şifre başarıyla değiştirildi.'});
                setOldPass('');
                setNewPass('');
            } else {
                setMessage({type: 'error', text: 'Mevcut şifre hatalı.'});
            }
        };

        const handleRecovery = () => {
            if(auth.recoverPassword(recovery)) {
                 setMessage({type: 'success', text: 'Şifre varsayılana sıfırlandı.'});
                 setRecovery('');
            } else {
                setMessage({type: 'error', text: 'Kurtarma yanıtı hatalı.'});
            }
        };

        return (
            <Modal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} title="Ayarlar">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-medium">Şifre Değiştir</h3>
                        <div className="mt-2 space-y-2">
                             <input type="password" placeholder="Mevcut Şifre" value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full input-style" />
                             <input type="password" placeholder="Yeni Şifre" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full input-style" />
                             <button onClick={handlePassChange} className="w-full btn-primary">Değiştir</button>
                        </div>
                    </div>
                     <div>
                        <h3 className="text-lg font-medium">Şifre Kurtarma</h3>
                        <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground mt-1">Şifrenizi unuttuysanız, kurtarma sorusunu yanıtlayın.</p>
                        <p className="text-sm font-medium text-foreground dark:text-dark-foreground mt-2">Soru: En sevilen yer?</p>
                        <div className="mt-2 space-y-2">
                             <input type="text" placeholder="Yanıt (laboratuvar)" value={recovery} onChange={e => setRecovery(e.target.value)} className="w-full input-style" />
                             <button onClick={handleRecovery} className="w-full btn-secondary">Şifreyi Sıfırla</button>
                        </div>
                    </div>
                    {message && <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</p>}
                </div>
            </Modal>
        )
    };
    
    const ArchiveModal: React.FC = () => (
         <Modal isOpen={activeModal === 'archive'} onClose={() => setActiveModal(null)} title="Arşivlenmiş Cihazlar" maxWidth="max-w-4xl">
             <div className="max-h-[70vh] overflow-y-auto">
                <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                    <thead className="bg-muted dark:bg-dark-muted">
                         <tr>
                            {ARCHIVE_COLUMNS.filter(c => c !== 'ID').map(col => <th key={col} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">{col}</th>)}
                            <th className="px-4 py-3"></th>
                         </tr>
                    </thead>
                    <tbody className="bg-card dark:bg-dark-card divide-y divide-border dark:divide-dark-border">
                        {inventory.archived.map(device => (
                            <tr key={device.ID}>
                                {ARCHIVE_COLUMNS.filter(c => c !== 'ID').map(col => <td key={col} className="px-4 py-2 whitespace-nowrap text-sm">{device[col as keyof ArchivedDevice]}</td>)}
                                <td className="px-4 py-2">
                                    <button onClick={() => inventory.restoreDevice(device.ID)} className="text-primary-600 hover:text-primary-800">Geri Yükle</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </Modal>
    );

    return (
        <div className={`min-h-screen ${theme}`}>
            <div className="bg-background text-foreground min-h-screen">
                <Header theme={theme} toggleTheme={toggleTheme} onSettingsClick={() => setActiveModal('settings')} />
                <main>
                    <TabsComponent activeTab={activeTab} setActiveTab={setActiveTab} />
                    <div className="p-4 md:p-6">
                        {renderContent()}
                    </div>
                </main>
                
                {/* Modals */}
                <DeviceFormModal />
                <ArchiveModal />
                <SettingsModal />
                <PasswordPromptModal 
                    isOpen={activeModal === 'password'}
                    onClose={() => setActiveModal(null)}
                    onSuccess={handlePasswordSuccess}
                    checkPassword={auth.checkPassword}
                />
            </div>
        </div>
    );
}

const ActionsMenu: React.FC<{
    device: Device;
    onEdit: (device: Device) => void;
    onArchive: (deviceId: number) => void;
}> = ({ device, onEdit, onArchive }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAction = (action: () => void) => {
        action();
        setIsOpen(false);
    }

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded-full hover:bg-accent dark:hover:bg-dark-accent">
                <Icon icon={MoreVertical} />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-md shadow-lg z-10">
                    <button onClick={(e) => {e.stopPropagation(); handleAction(() => onEdit(device))}} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-accent dark:hover:bg-dark-accent">
                        <Icon icon={Edit} className="w-4 h-4" /> Düzenle
                    </button>
                    <button onClick={(e) => {e.stopPropagation(); handleAction(() => onArchive(device.ID))}} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-destructive hover:bg-accent dark:hover:bg-dark-accent">
                        <Icon icon={Archive} className="w-4 h-4" /> Arşivle
                    </button>
                </div>
            )}
        </div>
    );
};


// Inventory View Component
const InventoryView: React.FC<{
    inventory: ReturnType<typeof useInventory>;
    onEdit: (device: Device) => void;
    onAuthenticatedEdit: (device: Device) => void;
    onArchive: (deviceId: number) => void;
    onAdd: () => void;
}> = ({ inventory, onEdit, onAuthenticatedEdit, onArchive, onAdd }) => {
    const { devices, notes, changeLogs, addNoteForDevice, deleteNoteById } = inventory;
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [displayedDevice, setDisplayedDevice] = useState<Device | null>(null);
    const [isDetailViewVisible, setIsDetailViewVisible] = useState(false);
    const [filterUnit, setFilterUnit] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Device; direction: 'asc' | 'desc' } | null>(null);
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [newNoteText, setNewNoteText] = useState('');
    const [noteSearchTerm, setNoteSearchTerm] = useState('');
    
    // Advanced filters state
    const [filterStatus, setFilterStatus] = useState<string>('Tümü');
    const [filterActive, setFilterActive] = useState<string>('Tümü');
    const [filterCalDateStart, setFilterCalDateStart] = useState<string>('');
    const [filterCalDateEnd, setFilterCalDateEnd] = useState<string>('');
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const filterPopoverRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (selectedDevice) {
            setDisplayedDevice(selectedDevice);
            setTimeout(() => setIsDetailViewVisible(true), 10);
        } else {
            setIsDetailViewVisible(false);
            const timer = setTimeout(() => setDisplayedDevice(null), 300); // Wait for animation
            return () => clearTimeout(timer);
        }
    }, [selectedDevice]);

    useEffect(() => {
        setNewNoteText('');
        setNoteSearchTerm('');
    }, [displayedDevice]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
                setIsFilterPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const units = useMemo(() => ['Tümü', ...Array.from(new Set(devices.map(d => d.Birim)))], [devices]);
    const statuses = useMemo(() => ['Tümü', ...Array.from(new Set(devices.map(d => d.Durum)))], [devices]);
    
    const filteredAndSortedDevices = useMemo(() => {
        let filtered = devices;
        if (filterUnit && filterUnit !== 'Tümü') {
            filtered = filtered.filter(d => d.Birim === filterUnit);
        }
        if (searchTerm) {
            filtered = filtered.filter(d => 
                Object.values(d).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        // Advanced filters
        if (filterStatus !== 'Tümü') {
            filtered = filtered.filter(d => d.Durum === filterStatus);
        }
        if (filterActive !== 'Tümü') {
            filtered = filtered.filter(d => d.Aktif === filterActive);
        }
        if (filterCalDateStart) {
            filtered = filtered.filter(d => d['Kalibrasyon Tarihi'] && new Date(d['Kalibrasyon Tarihi']) >= new Date(filterCalDateStart));
        }
        if (filterCalDateEnd) {
            filtered = filtered.filter(d => d['Kalibrasyon Tarihi'] && new Date(d['Kalibrasyon Tarihi']) <= new Date(filterCalDateEnd));
        }

        if (sortConfig) {
            filtered.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [devices, filterUnit, searchTerm, sortConfig, filterStatus, filterActive, filterCalDateStart, filterCalDateEnd]);

    const filteredNotes = useMemo(() => {
        if (!displayedDevice || !notes[displayedDevice.ID]) return [];
        return (notes[displayedDevice.ID] || []).filter(note =>
            note.not_metni.toLowerCase().includes(noteSearchTerm.toLowerCase())
        );
    }, [notes, displayedDevice, noteSearchTerm]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterStatus !== 'Tümü') count++;
        if (filterActive !== 'Tümü') count++;
        if (filterCalDateStart || filterCalDateEnd) count++;
        return count;
    }, [filterStatus, filterActive, filterCalDateStart, filterCalDateEnd]);

    const handleSort = (key: keyof Device) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getCalibrationStatusColor = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const calDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0,0,0,0);
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);

            if (calDate < today) return 'bg-red-500/10 dark:bg-red-500/20';
            if (calDate <= thirtyDaysFromNow) return 'bg-yellow-500/10 dark:bg-yellow-500/20';
        } catch (e) { return ''; }
        return '';
    };

    const handleNoteAdd = () => {
        if (!displayedDevice || !newNoteText.trim()) return;
        addNoteForDevice(displayedDevice.ID, newNoteText.trim());
        setNewNoteText('');
    };

    const handleNoteDelete = (noteId: number) => {
        if (!displayedDevice) return;
        if (window.confirm('Bu notu silmek istediğinizden emin misiniz?')) {
            deleteNoteById(displayedDevice.ID, noteId);
        }
    };
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            importFromExcel(file)
                .then(data => {
                    const newDevices = data.map(row => ({...row, ID: Date.now() + Math.random(), Aktif: 'Evet'} as Device));
                    inventory.setDevices(prev => [...prev, ...newDevices]);
                    alert(`${newDevices.length} cihaz başarıyla eklendi.`);
                })
                .catch(err => alert(`Hata: ${err.message}`));
        }
    };

    const clearFilters = () => {
        setFilterStatus('Tümü');
        setFilterActive('Tümü');
        setFilterCalDateStart('');
        setFilterCalDateEnd('');
        setIsFilterPopoverOpen(false);
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-150px)]">
            {/* Left Sidebar */}
            <div className="lg:col-span-1 bg-card dark:bg-dark-card rounded-lg shadow-lg p-4 flex flex-col space-y-4 h-full overflow-y-auto">
                <div>
                    <h3 className="font-bold text-lg mb-2">Birimler</h3>
                    <ul className="space-y-1">
                        {units.map(unit => (
                            <li key={unit}>
                                <button onClick={() => { setFilterUnit(unit); setSelectedDevice(null); }} className={`w-full text-left p-2 rounded-md text-sm transition-colors ${filterUnit === unit ? 'bg-primary-100 dark:bg-dark-primary/20 text-primary-700 dark:text-primary-300' : 'hover:bg-accent dark:hover:bg-dark-accent'}`}>
                                    {unit}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="border-t border-border dark:border-dark-border pt-4 flex-grow overflow-hidden flex flex-col">
                    <h3 className="font-bold text-lg mb-2 flex-shrink-0">Cihaz Detayları</h3>
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isDetailViewVisible ? 'max-h-full opacity-100' : 'max-h-0 opacity-0'}`}>
                        {displayedDevice ? (
                            <div className="text-sm space-y-4 overflow-y-auto pr-2">
                                <dl className="space-y-2">
                                {COLUMNS.filter(c => c !== 'ID').map(col => (
                                    <div key={col} className="grid grid-cols-2 gap-2">
                                        <dt className="font-semibold text-muted-foreground dark:text-dark-muted-foreground">{col}:</dt>
                                        <dd className="truncate">{displayedDevice[col as keyof Device]}</dd>
                                    </div>
                                ))}
                                </dl>
                                <div className="pt-2 space-y-4">
                                    <div>
                                        <h4 className="font-semibold mb-2">Notlar</h4>
                                        <div className="relative mb-2">
                                            <Icon icon={Search} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"/>
                                            <input
                                                type="text"
                                                placeholder="Notlarda ara..."
                                                value={noteSearchTerm}
                                                onChange={(e) => setNoteSearchTerm(e.target.value)}
                                                className="w-full pl-8 pr-2 py-1 text-sm border border-input dark:border-dark-input rounded-md bg-background dark:bg-dark-background focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                            {filteredNotes.length > 0 ? 
                                                filteredNotes.slice().reverse().map(note => (
                                                    <div key={note.ID} className="bg-muted dark:bg-dark-muted/50 p-2 rounded-md group relative">
                                                        <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground">{new Date(note.tarih).toLocaleDateString()}</p>
                                                        <p className="text-sm">{note.not_metni}</p>
                                                        <button 
                                                            onClick={() => handleNoteDelete(note.ID)} 
                                                            className="absolute top-1 right-1 p-0.5 rounded-full bg-background dark:bg-dark-background/50 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                            aria-label="Notu Sil"
                                                        >
                                                            <Icon icon={X} className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))
                                                : <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{noteSearchTerm ? 'Aramayla eşleşen not bulunamadı.' : 'Bu cihaza ait not bulunmuyor.'}</p>
                                            }
                                        </div>
                                        <div className="mt-4">
                                            <textarea 
                                                value={newNoteText}
                                                onChange={(e) => setNewNoteText(e.target.value)}
                                                placeholder="Yeni bir not ekle..."
                                                rows={3}
                                                className="w-full text-sm p-2 border border-input dark:border-dark-input rounded-md bg-background dark:bg-dark-background focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                            />
                                            <button 
                                                onClick={handleNoteAdd} 
                                                disabled={!newNoteText.trim()}
                                                className="w-full mt-2 btn-secondary text-sm disabled:opacity-50"
                                            >
                                                Not Ekle
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold">Değişim Geçmişi</h4>
                                        <div className="text-xs mt-1 max-h-24 overflow-y-auto bg-muted dark:bg-dark-muted/50 p-2 rounded">
                                            {(changeLogs[displayedDevice.ID] || []).length > 0 ?
                                                (changeLogs[displayedDevice.ID] || []).map(log => <p key={log.tarih}>{`${log.tarih.substring(0,10)}: ${log.alan} -> ${log.yeni}`}</p>).join('\n')
                                                : <p className="text-muted-foreground dark:text-dark-muted-foreground">Değişiklik yok.</p>
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : !isDetailViewVisible && !displayedDevice && <p className="text-muted-foreground dark:text-dark-muted-foreground">Detayları görmek için bir cihaz seçin.</p>}
                     </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 bg-card dark:bg-dark-card rounded-lg shadow-lg p-4 flex flex-col h-full">
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="relative flex-grow">
                         <Icon icon={Search} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5"/>
                         <input type="text" placeholder="Ekipman, model, seri no ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-input dark:border-dark-input rounded-md bg-background dark:bg-dark-background"/>
                    </div>
                     <div className="flex gap-2 flex-wrap">
                        <div className="relative">
                            <button onClick={() => setIsFilterPopoverOpen(prev => !prev)} className="btn-secondary flex items-center gap-2">
                                <Icon icon={Filter} /> Filtreler
                                {activeFilterCount > 0 && <span className="bg-primary-500 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>}
                            </button>
                            {isFilterPopoverOpen && (
                                <div ref={filterPopoverRef} className="absolute right-0 mt-2 w-72 bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-md shadow-lg z-20 p-4 space-y-4">
                                    <h4 className="font-semibold text-center">Filtreleme Seçenekleri</h4>
                                    <div>
                                        <label className="text-sm font-medium">Durum</label>
                                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full mt-1 input-style">
                                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Aktif Durumu</label>
                                        <select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="w-full mt-1 input-style">
                                            <option>Tümü</option>
                                            <option>Evet</option>
                                            <option>Hayır</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Kalibrasyon Tarih Aralığı</label>
                                        <div className="flex gap-2 mt-1">
                                            <input type="date" value={filterCalDateStart} onChange={e => setFilterCalDateStart(e.target.value)} className="w-full input-style text-sm"/>
                                            <input type="date" value={filterCalDateEnd} onChange={e => setFilterCalDateEnd(e.target.value)} className="w-full input-style text-sm"/>
                                        </div>
                                    </div>
                                    <button onClick={clearFilters} className="w-full btn-secondary text-sm">Filtreleri Temizle</button>
                                </div>
                            )}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2"><Icon icon={FileUp} /> Yükle</button>
                        <button onClick={() => exportToExcel(filteredAndSortedDevices, "envanter")} className="btn-secondary flex items-center gap-2"><Icon icon={FileDown} /> Aktar</button>
                        <button onClick={() => setActiveModal('archive')} className="btn-secondary flex items-center gap-2"><Icon icon={Archive} /> Arşiv</button>
                        <button onClick={onAdd} className="btn-primary flex items-center gap-2"><Icon icon={Plus} /> Yeni Cihaz</button>
                    </div>
                </div>
                <div className="flex-grow overflow-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted sticky top-0">
                            <tr>
                                {COLUMNS.filter(c => c !== 'ID').map(col => (
                                    <th key={col} onClick={() => handleSort(col as keyof Device)} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider cursor-pointer">
                                        <div className="flex items-center gap-2">
                                            {col}
                                            {sortConfig?.key === col ? (sortConfig.direction === 'asc' ? <Icon icon={ChevronUp}/> : <Icon icon={ChevronDown}/>) : <Icon icon={ChevronsUpDown} className="opacity-30"/>}
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-card dark:bg-dark-card divide-y divide-border dark:divide-dark-border">
                            {filteredAndSortedDevices.map(device => (
                                <tr key={device.ID} onClick={() => setSelectedDevice(device)} className={`cursor-pointer transition-colors hover:bg-accent dark:hover:bg-dark-accent/50 ${selectedDevice?.ID === device.ID ? 'bg-primary-50 dark:bg-dark-primary/10' : ''} ${getCalibrationStatusColor(device['Kalibrasyon Tarihi'])}`}>
                                     {COLUMNS.filter(c => c !== 'ID').map(col => (
                                        <td key={col} className="px-4 py-2 whitespace-nowrap text-sm">{device[col as keyof Device]}</td>
                                    ))}
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                                       <ActionsMenu device={device} onEdit={onAuthenticatedEdit} onArchive={onArchive} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


// Analysis View Component
const AnalysisView: React.FC = () => {
    const [inventory, setInventory] = useState<Record<string, any>[]>([]);
    const [pdfFiles, setPdfFiles] = useState<File[]>([]);
    const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
    const [pdfText, setPdfText] = useState('');
    const [analysisResult, setAnalysisResult] = useState<CertificateAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleInventoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const data = await importFromExcel(file);
                setInventory(data);
                alert('Envanter başarıyla yüklendi.');
            } catch (error) {
                alert('Envanter yüklenirken hata oluştu.');
            }
        }
    };

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setPdfFiles(prevFiles => {
                const allFiles = [...prevFiles];
                newFiles.forEach(newFile => {
                    // Avoid adding duplicates
                    if (!allFiles.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size)) {
                        allFiles.push(newFile);
                    }
                });
                return allFiles;
            });
            if (newFiles.length > 0) {
                selectPdf(newFiles[0]);
            }
        }
    };
    
    const handleClearPdfs = () => {
        setPdfFiles([]);
        setSelectedPdf(null);
        setPdfText('');
        setAnalysisResult(null);
        setIsLoading(false);
    };

    const selectPdf = async (file: File) => {
        setSelectedPdf(file);
        setPdfText('');
        setAnalysisResult(null);
        setIsLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                if (event.target?.result) {
                    const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
                    const pdf = await getDocument(typedarray).promise;
                    let textContent = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const text = await page.getTextContent();
                        textContent += text.items.map(item => ('str' in item) ? item.str : '').join(' ');
                    }
                    setPdfText(textContent);
                }
                 setIsLoading(false);
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("PDF text extraction error:", error);
            setPdfText("PDF metni çıkarılamadı.");
            setIsLoading(false);
        }
    };

    const handleAnalyze = async () => {
        if (!pdfText) return;
        setIsLoading(true);
        try {
            const result = await analyzeCertificateWithGemini(pdfText);
            setAnalysisResult(result);
        } catch (error) {
            console.error("Gemini analysis error:", error);
            alert("AI analizi sırasında bir hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-150px)]">
            {/* Left Panel: Controls */}
            <div className="lg:col-span-1 bg-card dark:bg-dark-card rounded-lg shadow-lg p-4 flex flex-col space-y-4">
                <h3 className="text-lg font-bold">Kontrol Paneli</h3>
                <div className="space-y-2">
                    <label className="btn-secondary w-full text-center cursor-pointer">
                        Envanteri Yükle (.xlsx)
                        <input type="file" className="hidden" accept=".xlsx" onChange={handleInventoryUpload} />
                    </label>
                    <label className="btn-secondary w-full text-center cursor-pointer">
                        PDF Sertifikaları Seç
                        <input type="file" className="hidden" accept=".pdf" multiple onChange={handlePdfUpload} />
                    </label>
                </div>
                <div className="border-t border-border dark:border-dark-border pt-4 flex-grow overflow-y-auto">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">Yüklenen PDF'ler</h4>
                        {pdfFiles.length > 0 && (
                             <button onClick={handleClearPdfs} className="text-sm text-destructive hover:underline px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors">
                                Tümünü Temizle
                            </button>
                        )}
                    </div>
                    <ul className="space-y-1">
                        {pdfFiles.map((file, index) => (
                            <li key={`${file.name}-${index}`}>
                                <button onClick={() => selectPdf(file)} className={`w-full text-left p-2 rounded-md text-sm truncate transition-colors ${selectedPdf?.name === file.name && selectedPdf?.size === file.size ? 'bg-primary-100 dark:bg-dark-primary/20' : 'hover:bg-accent dark:hover:bg-dark-accent'}`}>
                                    {file.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            
            {/* Right Panel: Viewer & Analysis */}
            <div className="lg:col-span-2 bg-card dark:bg-dark-card rounded-lg shadow-lg p-4 flex flex-col h-full">
                {selectedPdf ? (
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="text-lg font-bold truncate" title={selectedPdf.name}>{selectedPdf.name}</h3>
                           <button onClick={handleAnalyze} disabled={isLoading || !pdfText} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                               <Icon icon={Bot}/> {isLoading ? 'Analiz Ediliyor...' : 'AI ile Analiz Et'}
                           </button>
                        </div>
                        <div className="flex-grow overflow-y-auto border border-border dark:border-dark-border rounded-md p-4 bg-muted/50 dark:bg-dark-muted/50">
                            {isLoading && !analysisResult ? <div className="flex items-center justify-center h-full"><p>PDF içeriği okunuyor...</p></div> : null}
                            {analysisResult ? <AnalysisResultDisplay result={analysisResult} /> : <p className="text-sm text-muted-foreground">{pdfText || "PDF içeriği burada görünecek..."}</p>}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>{pdfFiles.length > 0 ? "Analiz için bir PDF seçin." : "Başlamak için bir envanter ve PDF sertifikaları yükleyin."}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AnalysisResultDisplay: React.FC<{ result: CertificateAnalysisResult }> = ({ result }) => {
    const statusInfo = {
        PASS: { icon: CheckCircle, color: 'text-green-500', label: 'GEÇTİ' },
        FAIL: { icon: AlertTriangle, color: 'text-red-500', label: 'KALDI' },
        INDETERMINATE: { icon: AlertTriangle, color: 'text-yellow-500', label: 'BELİRSİZ' }
    };
    const status = result.calibration_results?.status || 'INDETERMINATE';
    const info = statusInfo[status];

    return (
        <div className="space-y-6 text-sm animate-fade-in">
             <div className="p-4 bg-background dark:bg-dark-background/80 rounded-lg border border-border dark:border-dark-border">
                <h4 className="font-bold text-base mb-2 text-primary-600 dark:text-primary-400">AI Özet</h4>
                <p className="text-foreground dark:text-dark-foreground">{result.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-background dark:bg-dark-background/80 rounded-lg border border-border dark:border-dark-border">
                    <h5 className="font-semibold mb-3">Cihaz Bilgileri</h5>
                    <dl className="space-y-2">
                        <div className="flex justify-between"><dt className="text-muted-foreground">Seri No:</dt> <dd className="font-mono">{result.device_info?.serial_number}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted-foreground">Model:</dt> <dd className="font-mono">{result.device_info?.model}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted-foreground">Ekipman Tipi:</dt> <dd className="font-mono">{result.device_info?.equipment_type}</dd></div>
                    </dl>
                </div>
                 <div className="p-4 bg-background dark:bg-dark-background/80 rounded-lg border border-border dark:border-dark-border">
                    <h5 className="font-semibold mb-3">Kalibrasyon Sonuçları</h5>
                    <div className="space-y-2">
                        <div className={`flex items-center gap-2 text-lg font-bold ${info.color}`}>
                           <Icon icon={info.icon} className="w-6 h-6" />
                           <span>{info.label}</span>
                        </div>
                        <p><strong className="text-muted-foreground">Gerekçe:</strong> {result.calibration_results?.reasoning}</p>
                    </div>
                </div>
            </div>
             <div className="p-4 bg-background dark:bg-dark-background/80 rounded-lg border border-border dark:border-dark-border">
                <h5 className="font-semibold mb-2">Anahtar Ölçümler</h5>
                <ul className="list-disc list-inside space-y-1 pl-2 font-mono">
                    {result.calibration_results?.key_measurements.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
            </div>
        </div>
    );
};