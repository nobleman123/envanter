
import * as XLSX from 'xlsx';
import { Device } from '../types';
import { COLUMNS } from '../constants';

export const importFromExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const exportToExcel = (data: Device[], fileName: string) => {
    const dataToExport = data.map(device => {
        const row: Record<string, any> = {};
        COLUMNS.filter(c => c !== 'ID').forEach(col => {
            row[col] = device[col as keyof Device];
        });
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cihazlar');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
