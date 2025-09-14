# 🌍 Transparent Nonprofit Donation Tracking System

Welcome to a revolutionary Web3 solution for nonprofit transparency! This project uses the Stacks blockchain and Clarity smart contracts to ensure donations are tracked, allocated, and spent transparently, fostering trust between nonprofits and donors.

## ✨ Features

- 💸 **Secure Donation Collection**: Donors send STX (Stacks' native token) to nonprofits with unique donation IDs.
- 📊 **Fund Allocation**: Nonprofits allocate donations to specific projects or categories (e.g., education, healthcare).
- 🧾 **Spending Verification**: Nonprofits submit proof of spending, verified by authorized auditors.
- 🔍 **Public Transparency**: Donors and the public can view immutable records of donations and spending.
- 🛡️ **Access Control**: Only authorized parties (e.g., nonprofit admins, auditors) can perform sensitive actions.
- 🚫 **Fraud Prevention**: Prevents misuse of funds by enforcing allocation and spending rules.
- 📈 **Donor Analytics**: Donors can track their contributions and see how funds are used.
- 🔐 **Immutable Audit Trail**: All actions are recorded on-chain for permanent, tamper-proof transparency.

## 🛠 How It Works

### For Donors
- Donate STX to a nonprofit using the `donation-manager` contract, receiving a unique donation ID.
- Track your donation's allocation and spending via `donation-tracker` and `spending-verifier` contracts.
- Verify nonprofit accountability by checking immutable records in the `transparency-log` contract.

### For Nonprofits
- Register your organization with the `nonprofit-registry` contract.
- Allocate donations to projects using the `fund-allocator` contract.
- Submit spending proofs (e.g., receipts, invoices) via the `spending-submitter` contract.
- Authorized auditors verify spending through the `auditor-verifier` contract.

### For Auditors
- Use the `auditor-manager` contract to gain authorization.
- Review and approve spending proofs to ensure funds are used as intended.

### For the Public
- Query the `transparency-log` contract to view donation flows, allocations, and verified spending records.

## 📜 Smart Contracts

The system uses 8 Clarity smart contracts to manage the donation lifecycle:

1. **nonprofit-registry.clar**: Registers nonprofits with unique IDs and admin principals.
2. **donation-manager.clar**: Handles STX donations, assigns donation IDs, and routes funds.
3. **fund-allocator.clar**: Allows nonprofits to allocate donations to specific projects or categories.
4. **spending-submitter.clar**: Enables nonprofits to submit spending proofs (e.g., receipt hashes).
5. **auditor-manager.clar**: Manages auditor registration and authorization.
6. **auditor-verifier.clar**: Allows auditors to verify or reject spending proofs.
7. **donation-tracker.clar**: Tracks donation details and allocation history for donors.
8. **transparency-log.clar**: Maintains a public, immutable log of all actions (donations, allocations, spending).

## 🚀 Getting Started

### Prerequisites
- Stacks blockchain environment (testnet or mainnet).
- Clarity development tools (e.g., Clarinet).
- STX wallet for sending/receiving donations.

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/your-repo/nonprofit-donation-tracker.git
   ```
2. Install dependencies:
   ```bash
   cd nonprofit-donation-tracker
   npm install
   ```
3. Deploy contracts using Clarinet:
   ```bash
   clarinet deploy
   ```

### Usage
- **Nonprofits**: Register via `nonprofit-registry` and start accepting donations.
- **Donors**: Send STX to the nonprofit's address via `donation-manager` and track your donation.
- **Auditors**: Register with `auditor-manager` and verify spending proofs.
- **Public**: Query `transparency-log` for donation and spending details.

## 🧪 Example Workflow
1. A nonprofit registers with `nonprofit-registry`, providing their STX address and admin principal.
2. A donor sends 10 STX via `donation-manager`, receiving a donation ID.
3. The nonprofit allocates 5 STX to "Healthcare" and 5 STX to "Education" using `fund-allocator`.
4. The nonprofit submits a receipt hash for a $500 medical supply purchase via `spending-submitter`.
5. An auditor verifies the receipt using `auditor-verifier`.
6. Donors and the public view the donation flow and verified spending in `transparency-log`.

## 🔒 Security Features
- Only authorized nonprofit admins can allocate funds or submit spending proofs.
- Auditors must be registered and approved to verify spending.
- All actions are logged immutably on the Stacks blockchain.
- Donation IDs prevent double-spending or misattribution.

