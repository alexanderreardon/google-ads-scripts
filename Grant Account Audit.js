/**********************************************************************************************************************
This Adwords script checks a single Google grants account for mandatory requirements and logs the results in a Google Spreadsheet
UPDATED : 01.02.2019 (changed api version to v201809)
Author : Suisseo (Vincent Hsu)
More Info : https://www.suisseo.ch/en/blog/google-ad-grants-script/
1. Detect Campaigns with more than 15 conversions over the last 30 days has bidding strategy set to 'maximize conversion' to allow bids higher that 2 dollars
2. Detect if each Campaign has at least 2 active ad groups with at least 2 active text ads
3. Detect if each account has at least 2 active Sitelinks
4. Detect if each campaign has geo-targeting .
5. Detect Keywords that have a quality score under 3
6. Detect single keywords that are not branded or not in the authorized list
**********************************************************************************************************************/

//The url of the Spreadsheet
//Copy this template Google Spreadsheet in your Google Drive account : https://docs.google.com/spreadsheets/d/1rYif4Z9cTF1WmCRRl2w9vIOFy_ivs22_UpRP_qYHv08/copy
//You can change the name of the Spreadsheet, add Tabs, but do not change the names of the tabs in your Spreadsheet. 
//Save the url of and paste it below
var SPREADSHEETURL = 'https://docs.google.com/spreadsheets/d/YOURSPREADSHEETKEY/edit#gid=0';
//Array of e-mails to which a notification should be sent every time the report is executed, comma separated
var ALERTMAILS = ['YOUREMAIL@YOURDOMAIN:COM'];
//list of branded single keywords that should not be taken into account (any single keyword that contains any of these will not be reported), comma separated
var BRANDEDKEYWORDS = ['YOURBRAND', 'ANOTHERBRANDEDKEYWORD'];
//include paused campaigns, adgroups and Keywords in the reports can be set to true or false 
var INCLUDEPAUSED = false;
var authorizedOneWordersArray = getAuthorizedSingleWords();

function main() {
    runGrantsCheck()
}

function runGrantsCheck() {

    var account = AdWordsApp.currentAccount().getCustomerId();
    var SpreadsheetUrl = SPREADSHEETURL;
    var campaignSums = checkCampaigns(SpreadsheetUrl);
    var lowQSSum = getLowQualityKeywords(SpreadsheetUrl);
    var oneWorderSum = getOneWorders(SpreadsheetUrl, BRANDEDKEYWORDS);
    var ctr30Days = getAccountCtr(SpreadsheetUrl);
    var totalCost30Days = AdWordsApp.currentAccount().getStatsFor("LAST_30_DAYS").getCost();
    var access = new SpreadsheetAccess(SpreadsheetUrl, 'Abstract');
    access.clearAll();
    access.writeRows([
        ['Single keywords', 'Keywords with a quality \nscore smaller than 3', 'Campaigns with less \nthan 2 ad groups', 'Campaigns with \nno geo-targeting', 'Ad groups with less \nthan 2 active ads', 'Campaigns with less \nthan 2 sitelinks', 'CTR 30 days'],
        [oneWorderSum, lowQSSum, campaignSums[0], campaignSums[1], campaignSums[3], campaignSums[2], ctr30Days],
        ['=HYPERLINK("https://www.suisseo.ch/en/blog/google-ad-grants-script/","To check for script updates visit : https://www.suisseo.ch/en/blog/google-ad-grants-script/")', '', '', '', '', '', '']
    ], 1, 1);
    access.formatRows([
        ['#00ffff', '#00ffff', '#00ffff', '#00ffff', '#00ffff', '#00ffff', '#00ffff'],
        ['#ffff00', '#ffff00', '#ffff00', '#ffff00', '#ffff00', '#ffff00', '#ffff00']
    ], 1, 1);

    var emailMessageTitle = "Suisseo Grants Report - " + AdWordsApp.currentAccount().getName() + " - " + account;
    var emailMessageBody = "Your Google Grants report for the account : " + AdWordsApp.currentAccount().getName() + " - " + account + " is ready \n\n";
    emailMessageBody += "Here's what we found : \n\n";
    emailMessageBody += "Your CTR for the last 30 days is " + Math.round(ctr30Days * 100) / 100 + "%.\n";
    emailMessageBody += "You spent " + Math.round(totalCost30Days * 100) / 100 + "$ during the last 30 days.\n\n";
    emailMessageBody += oneWorderSum + " Keywords with one word.\n";
    emailMessageBody += lowQSSum + " Keywords with a quality score under 3.\n";
    emailMessageBody += campaignSums[0] + " campaigns with less than 2 active ad groups.\n";
    emailMessageBody += campaignSums[1] + " campaigns with no geo-targeting.\n";
    emailMessageBody += campaignSums[3] + " ad groups with less than 2 active ads.\n";
    emailMessageBody += campaignSums[2] + " campaigns with less than 2 sitelinks.\n\n\n";
    emailMessageBody += "Please visit this spreadsheet for more details: \n" + SPREADSHEETURL;

    //    if (new Date().getDay() == 3) {
    sendSimpleTextEmail(emailMessageTitle, ALERTMAILS, emailMessageBody)
        //    }
}

function checkCampaigns(SpreadsheetUrl) {
    var campaignTabName = 'Campaign Data';
    var adGroupTabName = 'AdGroup Data';
    var campaignRows = [];
    // less than 2 adgroups, campaign geo, campaign sitelinks, ads per adgroup
    var inc = [0, 0, 0, 0];
    var campaignFormatRows = [];
    var adGroupRows = [];
    var adGroupFormatRows = [];
    var status = "Status = ENABLED";
    if (INCLUDEPAUSED == true) { status = "Status != REMOVED"; }
    campaignRows.push(['CAMPAIGN NAME', 'BIDDING STRATEGY', "CONVERSIONS 30 DAYS", 'ACTIVE AD GROUPS', 'TARGETED LOCATIONS', 'CAMPAIGN SITELINKS', 'ACCOUNT SITELINKS']);
    adGroupRows.push(['CAMPAIGN NAME', 'AD GROUP NAME', 'ENABLED ADS']);
    var campaignIterator = AdWordsApp.campaigns()
        .withCondition(status)
        .forDateRange("LAST_30_DAYS")
        .get()
    while (campaignIterator.hasNext()) {
        var currentCampaign = campaignIterator.next();
        var campaignName = currentCampaign.getName();

        //to check if it is set to 'MAXIMIZE_CONVERSIONS'
        var campaignBiddingStrategy = currentCampaign.getBiddingStrategyType();
        var campaignConversions = currentCampaign.getStatsFor('LAST_30_DAYS').getConversions();
        var adGroupIterator = currentCampaign.adGroups()
            .withCondition("Status = ENABLED")
            .get();

        //We need to check if the number of ad groups is greater or equal to 2
        var totalNumAdGroups = adGroupIterator.totalNumEntities();
        //the location + the proximity number should be equal to 1 at least
        var totalNumargetedLocation = currentCampaign.targeting().targetedLocations().get().totalNumEntities();
        var totalNumargetedProximity = currentCampaign.targeting().targetedProximities().get().totalNumEntities();
        var totalGeo = totalNumargetedLocation + totalNumargetedProximity;
        var totalCampaignSitelinks = currentCampaign.extensions().sitelinks().get().totalNumEntities();
        var totalAccountSitelinks = checkAccountSiteLinks();
        // Red if not set to Maxime Conversions while having more than 15 conversions these last 30 days, green if set to 30 Maximize Conversions
        var campaignBiddingColor = '';
        if ((campaignBiddingStrategy != 'MAXIMIZE_CONVERSIONS') && (campaignConversions >= 15)) {
            campaignBiddingColor = '#f4cccc'
        }
        if ((campaignBiddingStrategy == 'MAXIMIZE_CONVERSIONS') && (campaignConversions >= 15)) {
            campaignBiddingColor = '#d9ead3'
        }
        //Logger.log(campaignName + " : Bid : " + campaignBiddingStrategy + " : Adgroups in campaign : " + totalNumAdGroups + " Targeted Locations + Proximities : " + totalGeo + " Campaign Sitelinks : " + totalCampaignSitelinks );
        campaignRows.push([campaignName, campaignBiddingStrategy, campaignConversions, totalNumAdGroups, totalGeo, totalCampaignSitelinks, totalAccountSitelinks]);
        campaignFormatRows.push([' ',
            campaignBiddingColor,
            '',
            totalNumAdGroups < 2 ? '#f4cccc' : '#d9ead3',
            totalGeo < 1 ? '#f4cccc' : '#d9ead3',
            totalCampaignSitelinks < 2 ? '#f4cccc' : '#d9ead3',
            totalAccountSitelinks < 2 ? '#f4cccc' : '#d9ead3',
        ]);
        if (totalNumAdGroups < 2) {
            inc[0] += 1;
        }
        if (totalGeo < 1) {
            inc[1] += 1;
        }
        if (totalCampaignSitelinks < 2 && totalAccountSitelinks < 2) {
            inc[2] += 1;
        }
        //Lets check the number of ads in each ad group
        while (adGroupIterator.hasNext()) {
            var currentAdGroup = adGroupIterator.next();
            var adsIterator = currentAdGroup.ads()
                .withCondition("Status = ENABLED")
                .get();
            if (adsIterator.totalNumEntities() < 2) {
                var currentAdGroupName = currentAdGroup.getName();
                inc[3] += 1;
                //Logger.log("Ad group : " + currentAdGroupName + " : has less than 2 enabled ads" )
                adGroupRows.push([campaignName, currentAdGroupName, adsIterator.totalNumEntities()])
                adGroupFormatRows.push(['', '',
                    '#f4cccc'
                ]);
            }
        }
    }
    var access = new SpreadsheetAccess(SpreadsheetUrl, campaignTabName);
    access.clearAll();
    access.writeRows(campaignRows, 1, 1);
    access.formatRows(campaignFormatRows, 2, 1);
    access.freezeFirstRow();
    access = new SpreadsheetAccess(SpreadsheetUrl, adGroupTabName);
    access.clearAll();
    access.writeRows(adGroupRows, 1, 1);
    access.formatRows(adGroupFormatRows, 2, 1);
    access.freezeFirstRow();

    return inc
}


//Refactored previous function using reports instead of iterators
function getOneWorders(SpreadsheetUrl, branded) {
    var incW = 0;
    var singleWordTabName = 'Single Word';
    var singleWordRows = [];
    var singleWordFormatRows = [];
    var status = "WHERE AdGroupStatus = 'ENABLED' AND CampaignStatus = 'ENABLED' AND Status = 'ENABLED' ";
    if (INCLUDEPAUSED == true) { status = "WHERE AdGroupStatus != 'REMOVED' AND CampaignStatus != 'REMOVED' AND Status != 'REMOVED' "; }
    singleWordRows.push(['CAMPAIGN NAME', 'ADGROUP NAME', 'KEYWORD']);
    var report = AdWordsApp.report("SELECT Criteria,CampaignName, CampaignStatus,AdGroupName,AdGroupStatus, Status " +
        "FROM KEYWORDS_PERFORMANCE_REPORT " +
        status +
        "DURING LAST_MONTH"

        , {
            includeZeroImpressions: true,
            apiVersion: 'v201809'
        });
    // Logger.log( "One Worder Keyywords" )
    var rows = report.rows();
    while (rows.hasNext()) {
        var row = rows.next();
        var kwLength = countWords(row['Criteria']);

        if (kwLength == 1) {
            kwLength = countWords(row['Criteria'].replace(/[|&|\/|\\|#|,|+|(|)|\-|$|~|%|.|'|"|:|*|?|<|>|{|}|]/g, ' ').trim());

            if (kwLength == 1) {
                //Logger.log( row['Criteria'] + ' -> ' + row['CampaignName'] + ' -> ' + row['AdGroupName']);
                var authorized = false
                for (i in authorizedOneWordersArray) {
                    if (authorizedOneWordersArray[i][0].toLowerCase() == row['Criteria'].toLowerCase().replace(/^\+/, '')) {
                        authorized = true;
                        //Logger.log(authorizedOneWordersArray[i][0]); 
                        break
                    }
                }
                for (p = 0; p < branded.length; p++) {
                    if (row['Criteria'].toLowerCase().replace(/^\+/, '').indexOf(branded[p].toLowerCase()) != -1) {
                        authorized = true;
                        //Logger.log(branded[p]); 
                        break
                    }
                }
                if (authorized == false) {
                    singleWordRows.push([row['CampaignName'], row['AdGroupName'], row['Criteria']]);
                    singleWordFormatRows.push(['', '', '#f4cccc']);
                    incW += 1;
                }
            }
        }
    }
    var access = new SpreadsheetAccess(SpreadsheetUrl, singleWordTabName);
    access.clearAll();
    access.writeRows(singleWordRows, 1, 1);
    access.formatRows(singleWordFormatRows, 2, 1);
    access.freezeFirstRow();
    //Logger.log('Found ' + incW + ' Keywords with one word')
    function countWords(str) {
        return str.trim().split(/\s+/).length;
    }

    return incW
}

//Refactored using reporting api
function getLowQualityKeywords(SpreadsheetUrl) {

    var lowQsTabName = 'Low QS';
    var lowQsRows = [];
    var lowQsFormatRows = [];
    var status = "WHERE AdGroupStatus = 'ENABLED' AND CampaignStatus = 'ENABLED' AND Status = 'ENABLED' AND QualityScore <= 2 ";
    if (INCLUDEPAUSED == true) { status = "WHERE AdGroupStatus != 'REMOVED' AND CampaignStatus != 'REMOVED' AND Status != 'REMOVED'  AND QualityScore <= 2 "; }
    lowQsRows.push(['CAMPAIGN NAME', 'ADGROUP NAME', 'KEYWORD']);
    var inc = 0;
    var report = AdWordsApp.report("SELECT Criteria,CampaignName, CampaignStatus,AdGroupName,AdGroupStatus, Status,QualityScore " +
        "FROM KEYWORDS_PERFORMANCE_REPORT " +
        status, {
            includeZeroImpressions: true,
            apiVersion: 'v201809'
        });
    //Logger.log( "Low Quality Keywords <=2" )
    var rows = report.rows();
    while (rows.hasNext()) {
        var row = rows.next();
        //Logger.log( row['Criteria'] + ' -> ' + row['CampaignName'] + ' -> ' + row['AdGroupName']);
        lowQsRows.push([row['CampaignName'], row['AdGroupName'], row['Criteria']]);
        lowQsFormatRows.push(['', '', '#f4cccc']);
        inc += 1;
    }
    var access = new SpreadsheetAccess(SpreadsheetUrl, lowQsTabName);
    access.clearAll();
    access.writeRows(lowQsRows, 1, 1);
    access.formatRows(lowQsFormatRows, 2, 1);
    access.freezeFirstRow();
    //Logger.log('Found ' + inc + ' Keywords with QS <= 2')

    return inc
}

function getAccountCtr(SpreadsheetUrl) {
    var ctrTabName = 'CTR';
    var ctrRows = [];
    var ctrFormatRows = [];
    ctrRows.push(['CTR LAST 7 DAYS', 'CTR LAST 14 DAYS', 'CTR LAST 30 DAYS']);
    var ctr7d = AdWordsApp.currentAccount().getStatsFor("LAST_7_DAYS").getCtr() * 100;
    var ctr14d = AdWordsApp.currentAccount().getStatsFor("LAST_14_DAYS").getCtr() * 100;
    var ctr30d = AdWordsApp.currentAccount().getStatsFor("LAST_30_DAYS").getCtr() * 100;

    //Logger.log(ctr7d + ' : ' + ctr14d + ' : ' + ctr30d)
    ctrRows.push([ctr7d, ctr14d, ctr30d]);
    ctrFormatRows.push([ctr7d < 5 ? '#f4cccc' : '#d9ead3', ctr14d < 5 ? '#f4cccc' : '#d9ead3', ctr30d < 5 ? '#f4cccc' : '#d9ead3']);

    var access = new SpreadsheetAccess(SpreadsheetUrl, ctrTabName);
    access.clearAll();
    access.writeRows(ctrRows, 1, 1);
    access.formatRows(ctrFormatRows, 2, 1);
    return ctr30d
}

function checkAccountSiteLinks() {
    //check account Sitelinks
    var accountSitelinkSelector = AdWordsApp.currentAccount().extensions().sitelinks()
    var accountSitelinkIterator = accountSitelinkSelector.get();
    var totalAccountSitelinks = accountSitelinkIterator.totalNumEntities();
    //Logger.log("Total Account Sitelinks " + totalAccountSitelinks)
    return totalAccountSitelinks
}

function SpreadsheetAccess(spreadsheetUrl, sheetName) {

    this.spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    this.sheet = this.spreadsheet.getSheetByName(sheetName);
    this.writeRows = function(rows, startRow, startColumn) {
        this.sheet.getRange(startRow, startColumn, rows.length, rows[0].length).
        setValues(rows);
    };
    this.formatRows = function(rows, startRow, startColumn) {
        if (rows[0]) {
            this.sheet.getRange(startRow, startColumn, rows.length, rows[0].length).
            setBackgrounds(rows);
        }
    };

    this.getRows = function(startColumn, endColumn) {
        var data = this.sheet.getDataRange().getValues();
        return data
    };

    this.clearAll = function() {
        this.sheet.clear();
    };

    this.freezeFirstRow = function() {
        this.sheet.setFrozenRows(1);
    };
}

//send e-mail
function sendSimpleTextEmail(title, emails, message) {
    var recipients = '';
    for (key in emails) {
        recipients += emails[key] + ',';

    }
    MailApp.sendEmail(emails.join(','),
        title,
        message);
}

//Get single keywords from Suisseo's Spreadsheet
function getAuthorizedSingleWords() {
    var words = [];
    var tabName = 'All'
    var singleKwSheet = "https://docs.google.com/spreadsheets/d/1wmllliOrBtxAn-qhT9O7BfJMLKs7MAYt50wNgUkTBPw/edit#gid=0"
    var access = new SpreadsheetAccess(singleKwSheet, tabName);
    var data = removeDuplicateInMultiArray(access.getRows());
    //for (i in data) {
    //  Logger.log(data[i][0]);
    //}

    return data
}

//Remove duplicates from first column in 2d array
function removeDuplicateInMultiArray(arr) {
    var uniqueArray = [];
    for (var i = 0; i < arr.length; i++) {
        var found = false;
        for (var z = 0; z < uniqueArray.length; z++) {
            if (arr[i][0] == uniqueArray[z][0]) {
                found = true;
                break;
            }
        }
        if (found == false) {
            uniqueArray.push(arr[i]);
        }
    }
    return uniqueArray
}