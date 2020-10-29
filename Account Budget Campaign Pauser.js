function main() {

    // Set the monthly spend amount to pause all campaigns at:
    var monthly_budget = 5000;
    // Email addresses to be notified when budget is hit:
    var emails = ['test@test.com'];


    // ---------------------------------------------------------


    var monthly_spend = 0;
    var active_campaigns = '';
    var accountId = AdsApp.currentAccount().getCustomerId();

    // Check if there are active campaigns:
    var activeCampaigns = AdsApp.campaigns().withCondition("Status = ENABLED").get();
    if (activeCampaigns.hasNext()) {

        // Total the MTD cost for all campaigns
        var campaignSelector = AdsApp
            .campaigns()
            .withCondition("Impressions > 0")
            .forDateRange("THIS_MONTH");

        var campaignIterator = campaignSelector.get();
        while (campaignIterator.hasNext()) {
            var campaign = campaignIterator.next();
            var campaign_spend = campaign.getStatsFor('THIS_MONTH').getCost();
            monthly_spend = monthly_spend + campaign_spend;
        }

        // If monthly_spend >= monthly_budget, pause all active campaigns:
        if (monthly_spend >= monthly_budget) {

            //  Get all active campaigns
            var campaignSelector = AdsApp.campaigns().withCondition("Status = 'ENABLED'");

            var campaignIterator = campaignSelector.get();
            while (campaignIterator.hasNext()) {
                var campaign = campaignIterator.next();
                // Pause each campaign & add it to list:
                active_campaigns = active_campaigns.concat(campaign.getName() + ' \n');
                campaign.pause();
            }

            // Format spend numbers:
            monthly_spend = numberWithCommas(monthly_spend);
            monthly_budget = numberWithCommas(monthly_budget);
            Logger.log("Campaigns paused: " + active_campaigns);
            // Email the results:
            MailApp.sendEmail(emails.join(','),
                // Email subject:
                'Google Ads account hit monthly budget - campaigns paused',
                // Email body:
                'The Google Ads account ' + accountId + ' spent ' + monthly_spend + ' out of its ' +
                monthly_budget + ' budget. The following campaigns have been paused: \n' + active_campaigns);


            // If monthly spend < monthly_budget, do nothing & log results:
        } else {
            Logger.log('Spent ' + monthly_spend + ' out of ' + monthly_budget + '. No action was taken.');
        };

    }
}

function numberWithCommas(x) {
    return x.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}