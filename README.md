# AppConnectors Events Automation

A Google Apps Script solution for processing AppConnectors event logs, filtering known errors, and generating comprehensive trend analysis directly in Google Sheets.

## 🎯 Overview

This automation helps you:
- **Direct Google Sheets Integration**: Works entirely within Google Sheets - no external tools needed
- **Filter Known Errors**: Automatically categorize and exclude 95%+ of known/expected errors
- **Track Real Failures**: Focus on genuine issues that require investigation  
- **Monthly Trends**: Generate automated trend analysis across multiple dimensions
- **Action Required Sheet**: Highlights real failures needing immediate attention
- **Zero External Dependencies**: No Python, CSV exports, authentication files, or Google Cloud setup

## ✅ Why This Approach is Better

- **No Google Cloud Console** setup required
- **No authentication** files needed  
- **Runs directly in Google Sheets** using your existing access
- **One-time setup** - works forever
- **Instant results** - processes data in seconds
- **5-minute setup** vs 30+ minutes for Python alternatives

## 📊 Features

### Error Classification
The system automatically categorizes errors into:

**Known Errors (Excluded from tracking):**
- Incorrect Downgrades (Adobe business logic limitations)
- Adobe API Authentication Issues
- Adobe Eligibility Errors (2129)
- Incorrect Pricebook Configuration
- Soft Cancellation Scenarios
- Adobe Internal Errors (1124)
- Incorrect Cancellation (Grace period)
- Empty Error Messages

**Real Failures (Tracked):**
- ISV Connectivity Issues
- Uncategorized Errors
- System Exceptions

### Generated Analysis Sheets
- **Dashboard**: Key metrics and summary statistics
- **ISV Trends**: Analysis by ISV Code with failure rate color coding
- **Tenant Trends**: Analysis by Tenant with monthly progression
- **Event Type Trends**: Analysis by Event Type patterns
- **Combined Trends**: Multi-dimensional analysis (ISV + Event Type + Tenant)
- **Charts**: Ready-to-use data for trend visualizations
- **Action Required**: Real failures needing investigation with original event details

## 🚀 Quick Start (5 minutes)

### Step 1: Prepare Your Google Sheet
1. Create a new Google Sheet or use your existing one
2. Add your data to sheets named:
   - `EventsByISV`: Aggregated events by ISV and tenant
   - `ErrorEvents`: Individual error events with details

### Step 2: Install the Google Apps Script
1. Open your Google Sheet
2. Go to **Extensions** → **Apps Script**
3. **Delete all existing code** in the editor
4. **Copy the entire contents** of `google_apps_script.js` from this repository
5. **Paste it** into the Apps Script editor
6. **Save** the project (Ctrl+S or Cmd+S)

### Step 3: Run the Automation
1. In the Apps Script editor, select the function: **`processAppConnectorsEvents`**
2. Click the **▶️ Run** button
3. **Grant permissions** when prompted (this is normal and safe)
4. Wait for completion message

### Step 4: View Results
Return to your Google Sheet and you'll see **7 new analysis sheets**:
- **📊 Dashboard** - Multi-dimensional analysis summary
- **📈 ISV Trends** - Trends by ISV Code with color coding
- **🏢 Tenant Trends** - Trends by Tenant with monthly data
- **📋 Event Type Trends** - Trends by Event Type patterns
- **🔗 Combined Trends** - Multi-dimensional combinations
- **📊 Charts** - Ready-to-use chart data and instructions
- **⚠️ Action Required** - Real failures needing immediate attention

## 🔄 Running Regularly

### Option 1: Manual Menu (Easiest)
After setup, you'll see a new menu in your Google Sheet:
- **AppConnectors Multi-Trend Analysis** → **🚀 Process All Sheets**
- Quick navigation: **📈 View Dashboard**, **🏢 View ISV Trends**, etc.
- Click **Process All Sheets** whenever you add new monthly data

### Option 2: Automatic Triggers
In Apps Script editor:
1. Click **⏰ Triggers** (clock icon)
2. **+ Add Trigger**
3. Choose: `processAppConnectorsEvents`
4. Event source: **Time-driven**
5. Type: **Day timer** or **Week timer**
6. Save

## 📋 Input Data Format

### EventsByISV Sheet
| Column | Required | Example | Description |
|--------|----------|---------|-------------|
| **Month** | ✅ | `Sept'25` | Month identifier |
| **ISV Code** | ✅ | `ADOBE` | Vendor identifier |
| **Event Type** | ✅ | `SUBSCRIPTION_CHANGE` | Event classification |
| **Tenant** | ✅ | `SOFTCHOICECANADA` | Customer/tenant |
| **Failed** | ✅ | `150` | Number of failed events |
| **Successful** | ✅ | `2850` | Number of successful events |
| **All Events** | ✅ | `3000` | Total events |
| **Failure Rate** | ✅ | `5.0` | Failure percentage |

### ErrorEvents Sheet
| Column | Required | Example | Description |
|--------|----------|---------|-------------|
| **Month** | ✅ | `Sept'25` | Month identifier |
| **Event ID** | ✅ | `c36e5bac-c542-...` | Unique identifier |
| **Timestamp** | ✅ | `2025-09-24T14:00:11.048Z` | Event timestamp |
| **Tenant** | ✅ | `SOFTCHOICECANADA` | Customer/tenant |
| **Message** | ✅ | `Unable to reduce quantity...` | Error message |
| **ISV Code** | ✅ | `ADOBE` | Vendor identifier |
| **Event Type** | ✅ | `SUBSCRIPTION_CHANGE` | Event classification |
| **Category** | ⚪ | `Incorrect Downgrades` | Error category (optional) |

## 🔧 Customization

### Adding New Error Categories
Edit the `ERROR_CATEGORIES` array in the Google Apps Script:

```javascript
const ERROR_CATEGORIES = [
  {
    name: "Your New Category",
    patterns: ["error pattern 1", "error pattern 2"],
    isKnownError: true, // or false for real failures
    description: "Description of this error category"
  },
  // ... existing categories
];
```

### Menu Customization
The script automatically creates a menu with options to:
- Process all sheets
- View individual analysis sheets
- Access the Action Required sheet

## 📈 Understanding the Results

### Dashboard Metrics
- **Total Events**: All events processed
- **Real Failures**: Events requiring attention
- **Known Errors**: Filtered out events
- **Failure Rates**: Calculated percentages
- **Trend Analysis**: Month-over-month changes

### Action Required Sheet
Shows individual error events that need investigation:
- Only includes non-known errors (real failures)
- Contains original event details (Event ID, timestamp, message)
- Organized with ISV Code, Event Type, Tenant information
- Status tracking for follow-up actions

## 🚨 Troubleshooting

### Common Issues

**Permission Denied**
- Grant all requested permissions - this is normal for Google Apps Script
- The script only accesses your own Google Sheet

**Script doesn't run**
- Check if sheets are named correctly (`EventsByISV`, `ErrorEvents`)
- Verify data format matches expected columns

**Script Timeout**
- If you have thousands of events, the script might timeout
- Split your data into smaller monthly chunks

**No data processed**
- Ensure your input sheets have the correct column headers
- Required columns for ErrorEvents: Event ID, Timestamp, Message, ISV Code, Event Type, Tenant

**Menu not appearing**
- Refresh the sheet or re-save the script
- Check if the `onOpen()` function ran successfully

### Getting Help
1. Check the execution log in Apps Script editor (View → Logs)
2. Verify your input data format matches the requirements
3. Ensure all required columns are present and named correctly

## 💡 Advantages Over Python Approach

| Feature | Google Apps Script | Python + Auth |
|---------|-------------------|---------------|
| Setup Time | 5 minutes | 30+ minutes |
| Authentication | None needed | Complex setup |
| Maintenance | Zero | Credential renewal |
| Sharing | Built-in | Additional setup |
| Updates | Automatic | Manual |
| Dependencies | None | Multiple libraries |

## 📁 Repository Structure

```
AppConnectorsEvents/
├── .gitignore                     # Git ignore rules
├── google_apps_script.js          # Main Google Apps Script
└── README.md                      # This file
```

## 🤝 Contributing

1. Fork the repository
2. Make your changes to `google_apps_script.js`
3. Test thoroughly with your data
4. Submit a pull request

## 🎉 You're Done!

This approach gives you:
- ✅ **No authentication hassles**
- ✅ **Instant setup and results**  
- ✅ **Built-in Google Sheets integration**
- ✅ **Configurable error categories**
- ✅ **Automatic monthly trend tracking**
- ✅ **Professional dashboard and analysis**
- ✅ **Action Required tracking for real failures**

Your AppConnectors automation is now **fully functional** and **maintenance-free**! 🚀

## 📄 License

This project is provided as-is for AppConnectors event analysis automation.