# Product Requirements Document (PRD)

## Product Overview
Internal SaaS for scheduling property inspections across Denmark, assigning them to part-time inspectors.

## Core Flow (MVP)

1. **Load Page 1** → table of unscheduled inspections
2. **Filter** by Department and Date
3. **Select** multiple inspections
4. **(Later)** push selections into VRP script for optimized scheduling
5. **(Later)** accept assignments → push into WorkFeed via shifts API

## Entities

### Inspection
- **Address**: Property location
- **Type**: Proforma, Projektsyn, Indflytningssyn, Fraflytningssyn
- **Date**: Scheduled date
- **Department**: Responsible department
- **Status**: Current state (UNSCHEDULED, SCHEDULED, CANCELLED)

### Inspector
- **Name**: Inspector full name
- **ID**: Unique identifier
- **Capabilities**: Types of inspections they can perform

### Availability
- **Inspector**: Reference to inspector
- **Date**: Available date
- **Status**: Available (Yes/No)

### Shift
- **Assignment**: Inspector assigned to an inspection
- **Details**: Date, time, location specifics

### VRP Suggestion
- **Proposed Assignment**: Optimizer-generated assignment recommendation
- **Score**: Optimization score/ranking

## Success Criteria (MVP)

✅ **End-to-end working Page 1**: 
- Load unscheduled inspections from Supabase
- Implement filtering functionality
- Enable multiple selection

✅ **Supabase schema ready**:
- inspections table
- availability table  
- shifts table
- VRP suggestions table

✅ **RLS enabled**: 
- Basic admin/scheduler policies implemented
- Proper access control

✅ **UX Requirements**:
- Clean and functional interface
- Optimized for internal schedulers
- Intuitive workflow

## Future Enhancements
- VRP optimization integration
- WorkFeed API integration
- Advanced reporting and analytics
- Mobile responsiveness for field inspectors