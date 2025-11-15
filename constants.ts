
import { Device } from './types';

export const COLUMNS: (keyof Device | 'ID')[] = [
    "Ekipman",
    "Birim Kodu",
    "Birim",
    "Model",
    "Seri No",
    "Kalibrasyon Tarihi",
    "Kalibrasyon Periyodu (ay)",
    "Son Kalibrasyon",
    "Durum",
    "Aktif",
    "ID"
];

export const ARCHIVE_COLUMNS = [...COLUMNS.filter(c => c !== 'ID'), "Arşivlenme Tarihi", "ID"];

export const INITIAL_PASSWORD = "admin123";
export const PASSWORD_RECOVERY_ANSWER = "laboratuvar";

export const INITIAL_DEVICES: Device[] = [
    {
        ID: 1,
        Ekipman: 'Dijital Pipet',
        'Birim Kodu': 'P-001',
        Birim: 'Kimya Lab',
        Model: 'Pipetman L',
        'Seri No': 'SN-12345',
        'Kalibrasyon Tarihi': '2024-12-15',
        'Kalibrasyon Periyodu (ay)': 12,
        'Son Kalibrasyon': '2023-12-15',
        Durum: 'Çalışıyor',
        Aktif: 'Evet'
    },
    {
        ID: 2,
        Ekipman: 'Analitik Terazi',
        'Birim Kodu': 'T-005',
        Birim: 'Fizik Lab',
        Model: 'Explorer EX224',
        'Seri No': 'SN-67890',
        'Kalibrasyon Tarihi': '2024-08-01',
        'Kalibrasyon Periyodu (ay)': 6,
        'Son Kalibrasyon': '2024-02-01',
        Durum: 'Çalışıyor',
        Aktif: 'Evet'
    },
    {
        ID: 3,
        Ekipman: 'Klimatik Kabin',
        'Birim Kodu': 'KK-002',
        Birim: 'Ar-Ge Merkezi',
        Model: 'Climacell EVO',
        'Seri No': 'SN-ABCDE',
        'Kalibrasyon Tarihi': '2024-07-20',
        'Kalibrasyon Periyodu (ay)': 12,
        'Son Kalibrasyon': '2023-07-20',
        Durum: 'Bakımda',
        Aktif: 'Evet'
    },
    {
        ID: 4,
        Ekipman: 'Santrifüj',
        'Birim Kodu': 'S-010',
        Birim: 'Biyoloji Lab',
        Model: '5424 R',
        'Seri No': 'SN-FGHIJ',
        'Kalibrasyon Tarihi': '2023-10-10',
        'Kalibrasyon Periyodu (ay)': 24,
        'Son Kalibrasyon': '2021-10-10',
        Durum: 'Kalibrasyon Geçmiş',
        Aktif: 'Evet'
    }
];
