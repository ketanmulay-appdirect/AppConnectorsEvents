# AppConnectors Events Automation

A comprehensive automation solution for processing AppConnectors event logs, filtering known errors, and creating JIRA tickets for real failures.

## 🎯 Overview

This project provides two main automation scripts:

1. **📊 Events Analysis & Trends** (`google_apps_script.js`) - Process event data and generate trend analysis
2. **🎫 Adobe Errors & JIRA Integration** (`adobe_errors_parser_jira_automation.js`) - Parse Adobe errors and create JIRA tickets

## 📊 Events Analysis & Trends

### Features
- **Direct Google Sheets Integration**: Works directly with your Google Sheet data
- **Filter Known Errors**: Automatically categorize and exclude 95%+ of known/expected errors
- **Track Real Failures**: Focus on genuine issues that require investigation  
- **Monthly Trends**: Generate automated monthly trend analysis
- **Live Dashboard**: Real-time metrics and insights in Google Sheets
- **Action Required Tracking**: Individual event tracking for real failures

### Error Classification
**Known Errors (Excluded from tracking):**
- Adobe API Authentication Issues
- Adobe Eligibility Errors
- Incorrect Downgrades
- Google API Errors
- Soft Cancellation Scenarios
- Empty Error Messages

**Real Failures (Tracked):**
- ISV Connectivity Issues
- Uncategorized Errors
- System Exceptions

### Setup
1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Replace the default code with `google_apps_script.js`
4. Save and run the `processAppConnectorsEvents` function
5. Use the custom menu: **AppConnectors Events → Process Data**

## 🎫 Adobe Errors & JIRA Integration

### Features
- **CSV Processing**: Parse Adobe error CSV files
- **Error Clubbing**: Group errors by tenant and category
- **Unique Records**: Create unique records per company/tenant/customer/subscription/error
- **JIRA Integration**: Automatically create Task tickets for each error category
- **Analysis Sheets**: Generate comprehensive analysis in Google Sheets

### JIRA Ticket Structure
- **Issue Type**: Task
- **Summary**: `AppConnectors Adobe Error: [Category] - [Tenant]`
- **Labels**: `appconnectors`, `automated`
- **Description**: Detailed error report with impact analysis

### Setup
1. Open your Google Sheet with Adobe error CSV data
2. Go to **Extensions → Apps Script**
3. Replace the default code with `adobe_errors_parser_jira_automation.js`
4. Update the `JIRA_CONFIG` section with your JIRA details:
   ```javascript
   const JIRA_CONFIG = {
     baseUrl: 'https://your-company.atlassian.net',
     username: 'your-email@company.com',
     apiToken: 'your-jira-api-token',
     projectKey: 'AC',
     issueType: 'Task'
   };
   ```
5. Save and run the `processCsvAndCreateJiraTickets` function

### JIRA Configuration
1. Generate API token from JIRA Account Settings
2. Update the `JIRA_CONFIG` object in the script
3. Ensure your JIRA project allows Task creation
4. Verify the project key is correct

## 📁 Project Structure

```
AppConnectorsEvents/
├── google_apps_script.js                    # Main events analysis script
├── adobe_errors_parser_jira_automation.js   # Adobe errors + JIRA automation
├── GOOGLE_APPS_SCRIPT_SETUP.md             # Setup guide for events analysis
├── ADOBE_ERRORS_PARSER_SETUP.md            # Setup guide for Adobe errors
├── README.md                                # This file
└── AppConnectors-Events-*.csv               # Sample data files
```

## 🚀 Quick Start

### For Events Analysis:
1. **Open Google Sheet**: [Your Events Sheet](https://docs.google.com/spreadsheets/d/1VpmjS9PGA9R2tBXh5fiazAhljgGc8BhokaqC8pg1HIo/edit)
2. **Add Script**: Copy `google_apps_script.js` to Apps Script
3. **Run Analysis**: Use the custom menu to process data
4. **View Results**: Check generated Dashboard, Trends, and Action Required sheets

### For Adobe Errors + JIRA:
1. **Prepare CSV**: Upload Adobe error CSV to Google Sheets
2. **Add Script**: Copy `adobe_errors_parser_jira_automation.js` to Apps Script
3. **Configure JIRA**: Update JIRA_CONFIG with your details
4. **Run Automation**: Process CSV and create JIRA tickets
5. **Review Tickets**: Check generated JIRA Tickets sheet for results

## 📊 Generated Sheets

### Events Analysis Output:
- **📊 Dashboard** - Key metrics and summary
- **📈 ISV Trends** - Trends by ISV Code
- **🏢 Tenant Trends** - Trends by Tenant
- **📋 Event Type Trends** - Trends by Event Type
- **🔄 Combined Trends** - Multi-dimensional analysis
- **📉 Charts** - Monthly aggregate trends
- **⚠️ Action Required** - Individual real failures needing attention

### Adobe Errors Output:
- **📊 Tenant Analysis** - Errors grouped by tenant and category
- **📋 Unique Records** - Deduplicated error records
- **🎫 JIRA Tickets** - Created ticket status and links

## 🔧 Customization

### Adding New Error Categories
Update the `ERROR_CATEGORIES` array in `google_apps_script.js`:

```javascript
{
  name: 'Custom Error Type',
  patterns: ['error pattern 1', 'error pattern 2'],
  severity: 'INFO',
  description: 'Description of this error type'
}
```

### Modifying JIRA Ticket Format
Edit the `createJiraTicket` function in `adobe_errors_parser_jira_automation.js` to customize:
- Summary format
- Description content
- Labels
- Additional fields

## 🛠 Troubleshooting

### Common Issues

**1. Google Apps Script Timeout**
- Break large datasets into smaller chunks
- Use batch processing for large operations

**2. JIRA Authentication Error**
- Verify API token is correct
- Check username/email format
- Ensure JIRA base URL is correct

**3. Missing Data in Sheets**
- Verify sheet names match expected format
- Check column headers are correct
- Ensure data is not filtered or hidden

### Debug Mode
Enable console logging in Apps Script:
```javascript
console.log('Debug info:', variableName);
```

View logs in Apps Script Editor → Execution transcript

## 📝 License

This automation script is provided as-is for internal use. Modify and distribute according to your organization's policies.

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review execution logs in Apps Script
3. Verify configuration settings
4. Test with sample data first

---

**Last Updated**: October 2025  
**Version**: 2.0.0  
**Compatibility**: Google Apps Script, Google Sheets, JIRA Cloud API