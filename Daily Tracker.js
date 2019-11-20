function main() {

    // Copy the ID of your Google Sheet, which is found in the URL between "/spreadsheets/d/" and "/edit"
    // Paste it below immediately after "?key=":
    var spreadsheet_url = "https://docs.google.com/spreadsheet/ccc?key=YOUR_SPREADSHEET_ID_HERE";

    // The name of the sheet you'd like to write the data to (ex. "Sheet1"):
    var sheetName = "Raw Data";

    // Specify the start date in "YYYMMDD" format (ex. "20190531"):
    var start_date = "20190101";

    // Specify the end date in "YYYMMDD" format (ex. "20191031").
    // You can also use yyyymmdd() to always return today:
    var end_date = yyyymmdd();

    // The API version to use for the request. If the script stopped working, it may be out of date.
    // Check here to find the latest version: https://developers.google.com/adwords/api/docs/reference/release-notes/
    var api_version = 'v201809';

    // Select which columns you'd like to return by un-commenting them out below (remove the //):
    var columns = ['Date',
        //'AccountCurrencyCode',
        //'AccountDescriptiveName',
        //'AccountId',
        //'AccountTimeZoneId',
        //'CustomerDescriptiveName',
        //'ExternalCustomerId',
        //'PrimaryCompanyName',
        //'PrimaryUserLogin',
        //'Device',
        //'BiddingStrategyType',
        'Clicks',
        'Impressions',
        'Cost',
        'AverageCpc',
        //'ConvertedClicks',
        'Conversions',
        //'CostPerConversion',
        //'ConversionRate',
        //'ConversionRateManyPerClick',
        //'ConversionValue',
        //'ValuePerConversion',
        //'ValuePerConversionManyPerClick',
        'ViewThroughConversions'
    ];
    var columns_str = columns.join(',') + " ";

    var sheet = getSpreadsheet(spreadsheet_url).getSheetByName(sheetName);
    sheet.clear();
    if (sheet.getRange('A1:A1').getValues()[0][0] == "") {
        // sheet.clear();
        sheet.appendRow(columns);
    }

    var report_iter = AdWordsApp.report(
        'SELECT ' + columns_str +
        'FROM ACCOUNT_PERFORMANCE_REPORT ' +
        'DURING ' + start_date + "," + end_date, {
            apiVersion: api_version
        }).rows();

    while (report_iter.hasNext()) {
        var row = report_iter.next();
        var row_array = [];
        for (var i in columns) {
            row_array.push(row[columns[i]]);
        }
        sheet.appendRow(row_array);
    }
}

function getSpreadsheet(spreadsheetUrl) {
    var matches = new RegExp('key=([^&#]*)').exec(spreadsheetUrl);
    if (!matches || !matches[1]) {
        throw 'Invalid spreadsheet URL: ' + spreadsheetUrl;
    }
    var spreadsheetId = matches[1];
    return SpreadsheetApp.openById(spreadsheetId);
}

function yyyymmdd() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    return '' + y + (m < 10 ? '0' : '') + m + (d < 10 ? '0' : '') + d;
}