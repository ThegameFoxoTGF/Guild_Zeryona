const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

function doGet() {
    return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('Zeryona')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getMaster() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const masterSheet = ss.getSheetByName('MasterUser');
    if (!masterSheet) {
        throw new Error('Master sheet "ManterUser" not found.');
    }

    const lastRow = masterSheet.getLastRow();
    if (lastRow === 0) {
        return []; // No data in the master sheet
    }

    const userNamesRange = masterSheet.getRange(1, 1, lastRow, 1);
    const userNames = userNamesRange.getValues().flat().filter(String);

    return userNames;
}

function getOrCreateYearlySheet(year){
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(year);


    if (!sheet) {
        sheet = ss.insertSheet(year);
        const masterUser = getMaster();
        let headers = ['date', 'guild', 'total'];

        if (masterUser.length > 0) {
            headers = headers.concat(masterUser);
        }
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    return sheet;
}


function getSheetData(dateStringHTML) {
  const date = new Date(dateStringHTML);
  const year = date.getFullYear().toString();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateDDMM = `${day}-${month}-${year}`;

  Logger.log(`[getSheetDataByDate] ขอข้อมูลปี: ${year}, วันที่ DD-MM: ${dateDDMM}`);

    try {
        const sheet = getOrCreateYearlySheet(year);
        if (sheet.getLastRow() === 0) {
            return {data : [], people: peopleNames}; // No data in the sheet
        }

        const allValues = sheet.getDataRange().getValues();
        const headers = allValues[0];
        const dateColIndex = headers.indexOf('date');
        if (dateColIndex === -1) {
            throw new Error('Date column not found in the sheet headers.');
        }

      const filteredData = [];
      for (let i = 1; i < allValues.length; i++) {
      const row = allValues[i];
      if (row[dateColIndex] && String(row[dateColIndex]) === dateDDMM) {
        filteredData.push({row:row , rowIndex: i + 1});
      }}

      return {data:filteredData,headers:headers};

    } catch (error) {
        console.error('Error in getSheetData:', error);
        return [];
    }
}

function updatePersonValues(payload) {
  const { date, person, updates } = payload;
  const year = new Date(date).getFullYear().toString();
  const sheet = getOrCreateYearlySheet(year);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const personColIndex = headers.indexOf(person) + 1;
  const totalColIndex = headers.indexOf('total') + 1;

  if (personColIndex <= 0) {
    throw new Error(`Person "${person}" not found in headers.`);
  }

  if (totalColIndex <= 0) {
    throw new Error(`Column 'total' not found in headers.`);
  }

  updates.forEach(update => {
    const rowIndex = update.rowIndex;

    // person
    const personCell = sheet.getRange(rowIndex, personColIndex);
    let currentVal = Number(personCell.getValue()) || 0;
    const newVal = currentVal + update.value;
    personCell.setValue(newVal);

    // total
    const rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    const peopleValues = rowValues.slice(totalColIndex); // สมมุติว่าหลัง total คือ people
    const total = peopleValues.reduce((sum, val) => sum + (Number(val) || 0), 0);

    sheet.getRange(rowIndex, totalColIndex).setValue(total);
  });
}



function getGuildsFromTemplate() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const templateSheet = ss.getSheetByName('Template');
    if (!templateSheet) {
        throw new Error('Template sheet not found.');
    }

    const lastRow = templateSheet.getLastRow();
    if (lastRow === 0) {
        return []; // No data in the template sheet
    }

    const guildsRange = templateSheet.getRange(1, 1, lastRow, 1);
    const guilds = guildsRange.getValues().flat().filter(String);

    return guilds;
}

function createData(dateStringHTML) {
  const date = new Date(dateStringHTML);
  const year = date.getFullYear().toString();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateDDMM = `${day}-${month}-${year}`;

  const sheet = getOrCreateYearlySheet(year);
  sheet.getRange('A:A').setNumberFormat('@');
  const guilds = getGuildsFromTemplate(); // from sheet Template
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRows = [];
  const peopleNames = headers.slice(3)
  // Check if the date already exists in the sheet
  const allValues = sheet.getDataRange().getValues();
  const existingRows = allValues.slice(1).filter(row => row[0] === dateDDMM);

  if (existingRows.length > 0) {
    return { success: false, message: `มีข้อมูลสำหรับวันที่ ${dateDDMM} อยู่แล้ว.` };
  }

  // New rows to be added
    guilds.forEach(guildName => {
      const row = [dateDDMM,guildName,0];
      for (let i = 0; i < peopleNames.length; i++) {
        row.push(0);
      }
      while (row.length < headers.length){
        row.push('');
      }
      newRows.push(row)
    })

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    return { success: true, message: `สร้างข้อมูลสำหรับ ${dateDDMM} แล้วจำนวน ${newRows.length} แถว.` };
  } else {
    return { success: false, message: "ไม่มีชื่อกิลด์ใน Template จึงไม่สามารถสร้างข้อมูลได้" };
  }
}
