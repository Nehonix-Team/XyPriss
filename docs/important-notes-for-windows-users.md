# Important Notes for Windows Users

> **Ensuring Smooth Execution & Managing Antivirus False Positives**

Thank you for choosing **XyPriss**!

XyPriss is a hybrid web framework that pairs the developer productivity of **TypeScript** with high-performance native compiled engines. To deliver this speed and security, XyPriss includes pre-compiled native binaries.

---

## 1. Antivirus False Positives on Windows

For internal security and protection reasons, some of our native binaries are compiled with code obfuscation. As a result, generic heuristic scanners—such as **Windows Defender** or third-party antivirus suites—may occasionally flag these binaries as unrecognized or suspicious.

> [!IMPORTANT]
> **This is a 100% false positive:**
> - Official XyPriss binaries are safe and contain no malware.
> - XyPriss and NEHONIX **never** collect, track, or share any personal data. Everything runs strictly on your machine.
> - For any questions or enterprise inquiries, contact us at **support@team.nehonix.com**.

---

## 2. Recommended Configuration on Windows

To develop seamlessly with XyPriss on Windows without files being quarantined or execution blocked, you have two options:

1. **Option A (Recommended for Quick Setup):** Temporarily turn off **Real-time protection** in Windows Security while installing dependencies (`xfpm install`) and running your development server (`xfpm dev` / `xfpm run`).
2. **Option B (Recommended for Long-term Development):** Add a persistent folder exclusion for XFPM and your development directories in Windows Defender.

---

## Option A: Temporarily Disabling Real-Time Protection

Follow the simple step-by-step walkthrough below to disable Real-time protection in Windows Defender.

### Step 1: Open Windows Security

You can open Windows Security using any of the following methods:
- Press <kbd>Win</kbd> + <kbd>I</kbd> to open **Settings** &rarr; navigate to **Privacy & security** &rarr; **Windows Security** &rarr; click **Open Windows Security**.
- Or simply open the Start menu, type **Windows Security**, and press <kbd>Enter</kbd>.

You will arrive at the **Security at a glance** dashboard:

<p align="center">
  <img src="./.assets/WD Home.png" alt="Windows Security - Security at a glance" width="700">
</p>

---

### Step 2: Navigate to Virus & Threat Protection Settings

1. In the left navigation menu or the dashboard cards, click on **Virus & threat protection**.
2. Scroll down to the **Virus & threat protection settings** section.
3. Click on the **Manage settings** hyperlink.

<p align="center">
  <img src="./.assets/WD step 2.png" alt="Windows Security - Virus & threat protection settings" width="700">
</p>

---

### Step 3: Turn Off Real-Time Protection

1. Locate the **Real-time protection** toggle switch at the top.
2. Click the toggle to switch it from **On** to **Off**.
3. When the Windows User Account Control (UAC) prompt appears asking *"Do you want to allow this app to make changes to your device?"*, select **Yes**.

<p align="center">
  <img src="./.assets/WD step 3.png" alt="Windows Security - Turn Off Real-time protection" width="700">
</p>

> [!NOTE]
> Windows Defender will notify you that Real-time protection is turned off. It will automatically re-enable itself after a system restart or when manually toggled back on.

---

## Option B: Adding a Persistent Folder Exclusion

If you prefer to keep Real-time protection enabled for the rest of your system, you can add persistent exclusions for the XyPriss package manager directory and your workspace projects.

### Via Windows Security GUI:
1. In the **Virus & threat protection settings** page (from Step 2 above), scroll down to the **Exclusions** section.
2. Click on **Add or remove exclusions**.
3. Click **Add an exclusion** &rarr; select **Folder**.
4. Add the following paths:
   - `%USERPROFILE%\.xfpm` (e.g. `C:\Users\<YourUser>\.xfpm`)
   - Your project workspace directory (e.g. `C:\Users\<YourUser>\Documents\projects\my-xypriss-app`)

### Via PowerShell (Run as Administrator):
Open an administrative PowerShell prompt and execute:

```powershell
# Add global XFPM directory to Windows Defender exclusions
Add-MpPreference -ExclusionPath "$HOME\.xfpm"

# Add your project workspace directory (replace with your actual project path)
Add-MpPreference -ExclusionPath "C:\Path\To\Your\XyPriss\Projects"
```

---

## 3. Third-Party Antivirus Suites

If you are using third-party endpoint protection (such as **Avast**, **AVG**, **Bitdefender**, **Kaspersky**, or **Norton**):

1. Open your antivirus control center.
2. Locate the **Protection Shields / Real-Time Scan** settings.
3. Either temporarily pause the shield while developing, or navigate to **Exceptions / Whitelist** and add:
   - The `%USERPROFILE%\.xfpm` directory
   - Your project repository folder

---

## 4. Need Assistance?

If you encounter any unexpected permission or binary lock issues on Windows, please check our [Troubleshooting Guide](https://xypriss.nehonix.com/docs/troubleshooting) or contact our security engineers directly at [support@team.nehonix.com](mailto:support@team.nehonix.com).