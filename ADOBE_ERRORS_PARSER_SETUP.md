# AppConnectors Adobe Errors Parser & JIRA Automation Setup

A Google Apps Script solution for parsing AppConnectors Adobe error CSV files and automatically creating JIRA tickets.

## 🎯 What This Script Does

1. **📊 Clubs errors per tenant** - Groups all errors by tenant for analysis
2. **📋 Creates unique records** - Deduplicates based on company, tenant, customer ID, subscription ID, and error category
3. **🎫 Creates JIRA tickets** - Automatically generates JIRA tickets per error category and tenant
4. **📈 Generates analysis sheets** - Creates comprehensive reports in Google Sheets

## 🚀 Quick Setup (10 minutes)

### Step 1: Prepare Your Data
1. **Upload Adobe Errors CSV to Google Sheets**:
   - Open Google Sheets
   - Create a new spreadsheet
   - Go to **File** → **Import** → **Upload**
   - Select your `AppConnectors-Adobe-Errors-*.csv` file
   - Choose **Replace spreadsheet** and **Detect automatically**

### Step 2: Install the Script
1. **Open Apps Script**:
   - In your Google Sheet, go to **Extensions** → **Apps Script**
   - Delete the default code
   - Copy and paste the entire contents of `csv_parser_jira_automation.js`
   - Save the project (Ctrl+S)

### Step 3: Configure JIRA (Optional)
1. **Update JIRA Configuration** in the script:
   ```javascript
   const JIRA_CONFIG = {
     baseUrl: 'https://your-company.atlassian.net',
     username: 'your-email@company.com',
     apiToken: 'your-jira-api-token', // Generate from JIRA Account Settings
     projectKey: 'AC', // Your JIRA project key
     issueType: 'Bug' // Issue type for error tickets
   };
   ```

2. **Generate JIRA API Token**:
   - Go to [JIRA Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Click **Create API token**
   - Copy the token and update the script

### Step 4: Run the Analysis
1. **Refresh your Google Sheet**
2. **New menu appears**: **AppConnectors Adobe Errors Parser**
3. **Click**: **🚀 Process CSV & Create JIRA Tickets**
4. **Grant permissions** when prompted
5. **Wait for completion** message

## 📊 Expected Results

### Generated Sheets:
1. **Tenant Analysis** - Errors grouped by tenant and category
2. **Unique Records** - Deduplicated error records
3. **JIRA Tickets** - Status of created JIRA tickets

### Sample Tenant Analysis:
| Tenant | Error Category | Total Count | Unique Customers | Unique Subscriptions |
|--------|---------------|-------------|------------------|---------------------|
| SOFTCHOICEUSA | 1116 - Invalid Customer | 45 | 3 | 12 |
| SOFTCHOICECANADA | 1116 - Invalid Customer | 32 | 2 | 8 |
| ACP | Currency Error | 104 | 15 | 25 |

### Sample JIRA Tickets Created:
- **AC-1234**: AppConnectors Adobe Error: 1116 - Invalid Customer - SOFTCHOICEUSA
- **AC-1235**: AppConnectors Adobe Error: 1116 - Invalid Customer - SOFTCHOICECANADA
- **AC-1236**: AppConnectors Adobe Error: Currency Error - ACP

## 🔧 Features

### Error Grouping
- **By Tenant**: All errors grouped by tenant value
- **By Category**: Errors categorized by type
- **Deduplication**: Unique records based on key fields
- **Statistics**: Count of unique customers and subscriptions affected

### JIRA Integration
- **Automatic Ticket Creation**: One ticket per tenant + error category combination
- **Priority Assignment**: Based on error count and customer impact
  - High: 100+ errors OR 10+ customers
  - Medium: 50+ errors OR 5+ customers
  - Low: Everything else
- **Rich Descriptions**: Includes error details, affected counts, time ranges
- **Labels**: Automatic labeling for easy filtering

### Analysis Sheets
- **Tenant Analysis**: Summary by tenant and error category
- **Unique Records**: Deduplicated individual error records
- **JIRA Tickets**: Status and links to created tickets

## 🎛️ Menu Options

After setup, you'll see a new menu with:
- **🚀 Process CSV & Create JIRA Tickets** - Main processing function
- **📊 View Tenant Analysis** - Jump to tenant analysis sheet
- **📋 View Unique Records** - Jump to unique records sheet
- **🎫 View JIRA Tickets** - Jump to JIRA tickets sheet
- **⚙️ Configure JIRA Settings** - Show configuration help

## 📋 CSV Data Format Expected

Your CSV should have these columns:
- **Timestamp** - When the error occurred
- **Company Uuid** - Company identifier
- **Tenant** - Tenant name (e.g., SOFTCHOICEUSA, ACP)
- **Error** - Error code/message
- **Message** - Detailed error message
- **Customer ID** - Customer identifier
- **Subscription ID** - Subscription identifier
- **Category** - Error category

## 🚨 Troubleshooting

### Common Issues

**"No data found in the active sheet"**
- Make sure your CSV is imported and the sheet with data is active
- Verify the CSV has headers in the first row

**"JIRA API error"**
- Check your JIRA configuration (baseUrl, username, apiToken)
- Verify your API token is valid
- Ensure you have permission to create issues in the project

**"Script timeout"**
- For large CSV files (1000+ rows), the script might timeout
- Process smaller batches or contact support for optimization

**"Permission denied"**
- Grant all requested permissions when prompted
- The script needs access to create sheets and make external API calls

### JIRA Configuration Help
1. **Base URL**: Your JIRA instance URL (e.g., https://company.atlassian.net)
2. **Username**: Your JIRA email address
3. **API Token**: Generate from JIRA Account Settings → Security → API tokens
4. **Project Key**: The key of your JIRA project (usually 2-4 letters)
5. **Issue Type**: Type of issue to create (Bug, Task, Story, etc.)

## 💡 Tips for Best Results

### Data Preparation
- Ensure your CSV has all required columns
- Remove any completely empty rows
- Verify tenant names are consistent

### JIRA Setup
- Create a dedicated project for AppConnectors Adobe errors
- Set up appropriate issue types and priorities
- Configure notifications for the team

### Regular Usage
- Run the script weekly or monthly with new error data
- Review generated JIRA tickets for patterns
- Use the analysis sheets for trend identification

## 🔄 Regular Workflow

1. **Export new Adobe errors CSV** from your error monitoring system
2. **Import to Google Sheets** (replace existing data)
3. **Run the script** via the menu
4. **Review generated tickets** in JIRA
5. **Analyze trends** in the generated sheets
6. **Take action** on high-priority errors

## 📈 Benefits

- **Automated JIRA Creation**: No manual ticket creation needed
- **Error Deduplication**: Avoid duplicate tickets for same issues
- **Tenant-based Organization**: Clear ownership and responsibility
- **Priority-based Triage**: Focus on high-impact errors first
- **Comprehensive Analysis**: Full visibility into error patterns
- **Time Savings**: Reduce manual error analysis from hours to minutes

Your AppConnectors Adobe error management is now **fully automated**! 🚀
