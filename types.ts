
export interface Device {
    ID: number;
    Ekipman: string;
    'Birim Kodu': string;
    Birim: string;
    Model: string;
    'Seri No': string;
    'Kalibrasyon Tarihi': string;
    'Kalibrasyon Periyodu (ay)': number;
    'Son Kalibrasyon': string;
    Durum: string;
    Aktif: 'Evet' | 'Hayır';
}

export interface ArchivedDevice extends Device {
    'Arşivlenme Tarihi': string;
}

export interface Note {
    ID: number;
    not_metni: string;
    tarih: string;
}

export interface ChangeLog {
    alan: string;
    eski: string;
    yeni: string;
    tarih: string;
}

export type Tab = 'inventory' | 'analysis';

export type ModalType = 'addDevice' | 'editDevice' | 'archive' | 'settings' | 'password' | null;


export interface CertificateAnalysisResult {
    summary: string;
    device_info: {
        serial_number: string;
        model: string;
        equipment_type: string;
    };
    calibration_results: {
        status: 'PASS' | 'FAIL' | 'INDETERMINATE';
        key_measurements: string[];
        reasoning: string;
    };
}
