# Scenarios Module

This folder contains all scenario-related functionality that has been moved out of the main application structure. The scenarios feature is currently **commented out** from the main navigation and routes.

## 📁 Files Moved Here

### **Core Files**
- `Scenarios.tsx` - Main scenarios page component
- `scenarios.ts` - Scenario template definitions (formerly `data/scenarios.ts`)
- `scenario-data.ts` - Type definitions (formerly `types/scenario-data.ts`)

### **Services**
- `scenario-api.ts` - Real ThingsBoard scenario API integration
- `scenario-mock.ts` - Mock scenario service for testing

### **State Management**
- `useScenarioRun.ts` - Scenario execution state management
- `useScenarios.ts` - Scenario data state management

### **Hooks**
- `useScenarioLiveData.ts` - Real-time scenario data monitoring
- `useScenarioLiveDataMock.ts` - Mock version for testing

### **Components**
- `CreateScenarioDialog.tsx` - Dialog for creating new scenarios
- `ScenarioCard.tsx` - Individual scenario display component
- `ScenarioCountdown.tsx` - Countdown component for scenario start

## 🚫 Current Status

The scenarios functionality is **temporarily disabled** in the main application:

- ❌ Commented out from navigation (`Sidebar.tsx`)
- ❌ Commented out from routes (`App.tsx`) 
- ❌ Not accessible through main UI

## 🔄 Re-enabling Instructions

To re-enable scenarios in the future:

1. **Uncomment navigation** in `src/components/shared/Sidebar.tsx`:
   ```typescript
   { title: 'Scenarios', icon: Calendar, path: '/dashboard/scenarios' },
   ```

2. **Uncomment route** in `src/App.tsx`:
   ```typescript
   import Scenarios from '../scenarios/Scenarios';
   // ... 
   <Route path="/dashboard/scenarios" element={<Scenarios />} />
   ```

3. **Update import paths** if needed to reference this folder

## 🎮 Replacement

The **Games** section (`src/pages/Games.tsx`) now serves as the primary interface for game/scenario functionality, implementing the complete ThingsBoard game flow according to DeviceManagement.md.

## 📝 Notes

- All imports within this folder have been updated to use relative paths
- External dependencies on scenarios have been updated to reference this folder
- The Games section provides superior functionality with real ThingsBoard integration
