# Demo Mode Verification Checklist

## ✅ Quick Test - 2 Minutes

### Step 1: Enable Demo Mode
1. Open: `http://localhost:8081/dashboard`
2. Check header shows: **🎭 Demo** (yellow badge)
3. Yellow banner appears: "Demo Mode Active"

### Step 2: Verify Demo Data

**Dashboard:**
- [ ] Total Targets: **6** (not real count)
- [ ] Total Rooms: **3** (not real count)
- [ ] Recent Games: Shows mock games
- [ ] Console: `✅ DEMO: Loaded mock targets: 6`
- [ ] Console: `✅ DEMO: Loaded mock sessions: 5`
- [ ] NO API calls in Network tab

**Games Page:**
- [ ] Yellow banner visible
- [ ] Devices: **6** (Alpha, Bravo, Charlie, Delta, Echo, Foxtrot)
- [ ] Console: `✅ DEMO: Loaded 6 mock devices`
- [ ] NO real devices shown

**Targets Page:**
- [ ] Yellow banner visible
- [ ] Unassigned Targets: Exactly **6** targets (Alpha through Foxtrot)
- [ ] Console: `✅ DEMO: Loaded mock targets: 6`
- [ ] NO duplicates
- [ ] NO real targets

**Rooms Page:**
- [ ] Shows **3** mock rooms (Training Range A, Competition Range, Practice Zone)
- [ ] Console: `✅ DEMO: Loaded mock rooms: 3`
- [ ] NO real rooms

### Step 3: Switch to Live Mode
1. Click **Toggle** button in header
2. Header shows: **🔗 Live** (green badge)
3. Yellow banners disappear

### Step 4: Verify Live Data

**Dashboard:**
- [ ] Shows REAL target count from ThingsBoard
- [ ] Shows REAL room count from Supabase
- [ ] Console: `🔗 LIVE: Loaded real targets`
- [ ] Network tab shows API calls

**Games Page:**
- [ ] NO yellow banner
- [ ] Shows REAL devices from ThingsBoard
- [ ] Console: `✅ LIVE: Loaded [N] devices from ThingsBoard`

**Targets Page:**
- [ ] NO yellow banner
- [ ] Shows REAL targets (no duplicates)
- [ ] Console: `✅ LIVE: Loaded real targets`

**Rooms Page:**
- [ ] Shows REAL rooms from Supabase
- [ ] Console: `✅ Rooms fetched successfully`

## 🚨 Critical Checks

### Data Isolation
- [ ] Demo mode shows NO real data
- [ ] Live mode shows NO mock data
- [ ] Switching modes clears old data (console shows: `🧹 Cleared old data`)

### Console Logs
- [ ] Demo mode: ALL logs have `🎭 DEMO` prefix
- [ ] Live mode: ALL logs have `🔗 LIVE` prefix
- [ ] NO mixing of prefixes

### Network Tab
- [ ] Demo mode: **ZERO** API calls to ThingsBoard/Supabase
- [ ] Live mode: API calls visible

## ✅ If All Checks Pass

Demo mode is working correctly! You now have:
- **🎭 Demo Mode**: Complete mock data for all pages
- **🔗 Live Mode**: Real ThingsBoard + Supabase data
- **🔒 Data Isolation**: No leakage between modes
- **👁️ Visual Indicators**: Yellow banners in demo mode
- **📝 Clear Logging**: Console shows current mode

---

## 🐛 If Tests Fail

1. Clear browser data:
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. Check console for errors

3. Verify files saved correctly (no pending changes)

4. Restart dev server

