/**
 * Blood Donor Finder - Core Application Logic
 * Powered by Firebase Auth & Firestore
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

// 1. Firebase Configuration (Provided by User)
const firebaseConfig = {
  apiKey: "AIzaSyC0xoKbxlstZ19ljlSI_zLAGtmq8khaaUM",
  authDomain: "blood-donor-finder-ef775.firebaseapp.com",
  projectId: "blood-donor-finder-ef775",
  storageBucket: "blood-donor-finder-ef775.firebasestorage.app",
  messagingSenderId: "371816953064",
  appId: "1:371816953064:web:9a770eacc1191117bf055d"
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Application State
const state = {
  currentUser: null,
  currentDonorProfile: null,
  firestoreDonors: [],
  defaultSeedDonors: [
    {
      id: "seed-1",
      name: "David Vance",
      bloodGroup: "O+",
      city: "Brooklyn, New York",
      phoneNumber: "+1 (555) 234-5678",
      isAvailable: true,
      donationsCount: 8,
      distance: "1.8 miles away",
      isVerified: true
    },
    {
      id: "seed-2",
      name: "Dr. Sarah Jenkins",
      bloodGroup: "O-",
      city: "Manhattan, New York",
      phoneNumber: "+1 (555) 491-8822",
      isAvailable: true,
      donationsCount: 14,
      distance: "2.4 miles away",
      isVerified: true,
      isUniversal: true
    },
    {
      id: "seed-3",
      name: "Marcus Chen",
      bloodGroup: "A+",
      city: "Queens, New York",
      phoneNumber: "+1 (555) 773-1029",
      isAvailable: false,
      donationsCount: 5,
      distance: "3.1 miles away",
      isVerified: true,
      lastDonated: "Eligible (4m ago)"
    },
    {
      id: "seed-4",
      name: "Priya Sharma",
      bloodGroup: "B+",
      city: "Jersey City, NJ",
      phoneNumber: "+1 (555) 902-3341",
      isAvailable: true,
      donationsCount: 9,
      distance: "4.6 miles away",
      isVerified: true
    },
    {
      id: "seed-5",
      name: "Elena Rostova",
      bloodGroup: "AB+",
      city: "Long Island City, NY",
      phoneNumber: "+1 (555) 612-4401",
      isAvailable: true,
      donationsCount: 11,
      distance: "3.8 miles away",
      isVerified: true
    },
    {
      id: "seed-6",
      name: "James Wilson",
      bloodGroup: "B-",
      city: "Staten Island, NY",
      phoneNumber: "+1 (555) 830-9921",
      isAvailable: false,
      donationsCount: 4,
      distance: "5.2 miles away",
      isVerified: true,
      lastDonated: "Eligible (3m ago)"
    }
  ],
  filters: {
    bloodGroup: "ALL",
    city: "New York",
    urgency: "all"
  }
};

/* ==========================================================================
   Toast Notification System
   ========================================================================== */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconName = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  const iconColor = type === 'success' ? 'text-tertiary-container' : type === 'error' ? 'text-primary' : 'text-blue-600';
  
  toast.innerHTML = `
    <span class="material-symbols-outlined ${iconColor} text-[20px]">${iconName}</span>
    <span class="flex-1 text-sm font-medium text-on-surface">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

/* ==========================================================================
   Modal Helpers
   ========================================================================== */
export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// Global modal triggers
window.openModal = openModal;
window.closeModal = closeModal;

/* ==========================================================================
   Authentication Listeners & Handlers
   ========================================================================== */
onAuthStateChanged(auth, async (user) => {
  state.currentUser = user;
  updateAuthUI(user);

  if (user) {
    // Listen to current user's donor document in Firestore
    const userDocRef = doc(db, 'donors', user.uid);
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        state.currentDonorProfile = { id: snap.id, ...snap.data() };
      } else {
        state.currentDonorProfile = null;
      }
      updateDonorProfileBadge();
    } catch (err) {
      console.warn("Could not load user's donor record:", err);
    }
  } else {
    state.currentDonorProfile = null;
    updateDonorProfileBadge();
  }

  renderDonors();
});

function updateAuthUI(user) {
  const loggedOutNav = document.getElementById('loggedOutNav');
  const loggedInNav = document.getElementById('loggedInNav');
  const userEmailDisplay = document.getElementById('userEmailDisplay');
  const donorProfileBadgeWrapper = document.getElementById('donorProfileBadgeWrapper');
  const heroLoginActionBtn = document.getElementById('heroLoginActionBtn');

  if (user) {
    if (loggedOutNav) loggedOutNav.classList.add('hidden');
    if (loggedInNav) loggedInNav.classList.remove('hidden');
    if (userEmailDisplay) userEmailDisplay.textContent = user.email || 'Donor Account';
    if (heroLoginActionBtn) {
      heroLoginActionBtn.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">account_circle</span>
        <span>My Profile</span>
      `;
      heroLoginActionBtn.onclick = () => openDonorProfileModal();
    }
  } else {
    if (loggedOutNav) loggedOutNav.classList.remove('hidden');
    if (loggedInNav) loggedInNav.classList.add('hidden');
    if (donorProfileBadgeWrapper) donorProfileBadgeWrapper.classList.add('hidden');
    if (heroLoginActionBtn) {
      heroLoginActionBtn.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">account_circle</span>
        <span>Donor Login</span>
      `;
      heroLoginActionBtn.onclick = () => openModal('authModal');
    }
  }
}

function updateDonorProfileBadge() {
  const badgeWrapper = document.getElementById('donorProfileBadgeWrapper');
  const badgeStatusText = document.getElementById('donorBadgeStatusText');
  const headerQuickToggle = document.getElementById('headerQuickToggle');

  if (!badgeWrapper || !badgeStatusText) return;

  if (state.currentUser && state.currentDonorProfile) {
    const p = state.currentDonorProfile;
    badgeWrapper.classList.remove('hidden');
    
    if (p.isAvailable) {
      badgeStatusText.className = "px-space-xs py-0.5 rounded-full bg-emerald-100 font-label-sm text-label-sm text-tertiary-container font-bold flex items-center gap-1";
      badgeStatusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-tertiary-container"></span> ${p.bloodGroup} Active`;
    } else {
      badgeStatusText.className = "px-space-xs py-0.5 rounded-full bg-slate-200 font-label-sm text-label-sm text-slate-600 font-bold flex items-center gap-1";
      badgeStatusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400"></span> ${p.bloodGroup} Inactive`;
    }

    if (headerQuickToggle) {
      headerQuickToggle.checked = !!p.isAvailable;
    }
  } else {
    badgeWrapper.classList.add('hidden');
  }
}

/* ==========================================================================
   Realtime Firestore Donors Listener
   ========================================================================== */
const donorsCol = collection(db, 'donors');

onSnapshot(donorsCol, (snapshot) => {
  const liveDonors = [];
  snapshot.forEach((docSnap) => {
    liveDonors.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  state.firestoreDonors = liveDonors;

  // If logged in, update user profile reference
  if (state.currentUser) {
    const myDoc = liveDonors.find(d => d.userId === state.currentUser.uid || d.id === state.currentUser.uid);
    if (myDoc) {
      state.currentDonorProfile = myDoc;
      updateDonorProfileBadge();
    }
  }

  renderDonors();
}, (error) => {
  console.error("Firestore donors query listener error:", error);
});

/* ==========================================================================
   Search & Filter Execution
   ========================================================================== */
export function triggerSearch() {
  const bloodSelect = document.getElementById('searchBloodGroup');
  const locInput = document.getElementById('searchLocation');

  if (bloodSelect) state.filters.bloodGroup = bloodSelect.value;
  if (locInput) state.filters.city = locInput.value.trim();

  renderDonors();
}
window.triggerSearch = triggerSearch;

export function setUrgencyFilter(type) {
  state.filters.urgency = type;
  const pills = document.querySelectorAll('.urgency-pill');
  pills.forEach(pill => {
    if (pill.dataset.urgency === type) {
      pill.className = 'urgency-pill active-pill px-3 py-1.5 rounded-full bg-secondary-container text-primary font-label-md text-label-md font-bold transition-all';
    } else {
      pill.className = 'urgency-pill px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-all';
    }
  });

  renderDonors();
}
window.setUrgencyFilter = setUrgencyFilter;

/* ==========================================================================
   Render Donors Grid
   ========================================================================== */
function renderDonors() {
  const grid = document.getElementById('donorCardsGrid');
  const countLabel = document.getElementById('resultsCountLabel');
  if (!grid) return;

  // Combine Firestore donors and fallback seed donors
  // Avoid duplicate if Firestore already has a donor with identical phone/id
  const firestoreIds = new Set(state.firestoreDonors.map(d => d.userId || d.id));
  const combined = [
    ...state.firestoreDonors,
    ...state.defaultSeedDonors.filter(s => !firestoreIds.has(s.id))
  ];

  // Apply filters
  const { bloodGroup, city, urgency } = state.filters;
  const queryCity = city.toLowerCase();

  const filtered = combined.filter(donor => {
    // 1. Blood group match
    if (bloodGroup !== 'ALL' && donor.bloodGroup !== bloodGroup) {
      return false;
    }

    // 2. City match (partial match or empty)
    if (queryCity && queryCity.length > 0) {
      const donorCity = (donor.city || '').toLowerCase();
      // If user typed city, check if city includes it or donor city includes query
      if (!donorCity.includes(queryCity) && !queryCity.includes(donorCity)) {
        return false;
      }
    }

    // 3. Urgency pill filter
    if (urgency === 'now') {
      if (!donor.isAvailable) return false;
    } else if (urgency === 'urgent') {
      // Urgent trauma blood groups: O- and B-
      if (donor.bloodGroup !== 'O-' && donor.bloodGroup !== 'B-') {
        return false;
      }
    }

    return true;
  });

  // Update counter
  if (countLabel) {
    const activeInFilter = filtered.filter(d => d.isAvailable).length;
    const filterDesc = bloodGroup === 'ALL' ? 'All Blood Groups' : bloodGroup;
    countLabel.innerHTML = `Showing <span class="font-bold text-on-surface">${filtered.length} donors (${activeInFilter} active)</span> in ${city || 'All Cities'} (${filterDesc})`;
  }

  // Render cards
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 px-6 text-center bg-surface-container-lowest rounded-2xl border border-slate-200">
        <div class="w-14 h-14 mx-auto rounded-full bg-error-container/60 flex items-center justify-center text-primary mb-4">
          <span class="material-symbols-outlined text-[28px]">search_off</span>
        </div>
        <h3 class="text-xl font-bold text-on-surface mb-1">No Matching Donors Found</h3>
        <p class="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
          There are currently no registered donors for <strong>${bloodGroup}</strong> in "<strong>${city}</strong>". You can register to be the first lifesaving volunteer!
        </p>
        <button onclick="window.handleRegisterClick()" class="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-hover shadow-sm inline-flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">volunteer_activism</span>
          <span>Register as First Donor</span>
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(donor => {
    const isOwner = state.currentUser && (donor.userId === state.currentUser.uid || donor.id === state.currentUser.uid);
    const isOminus = donor.bloodGroup === 'O-';
    
    // Blood box style
    const isUniversalRed = isOminus || donor.bloodGroup === 'B-';
    const bloodBoxClass = isUniversalRed ? 'bg-error-container text-error' : 'bg-secondary-fixed text-primary';

    // Status chip
    let statusChipHtml = '';
    if (donor.isAvailable) {
      statusChipHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-tertiary-container font-label-sm text-label-sm font-semibold">
          <span class="w-2 h-2 rounded-full bg-tertiary-container animate-pulse"></span> Available Now
        </span>
      `;
    } else {
      statusChipHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
          ${donor.lastDonated || 'Temporarily Inactive'}
        </span>
      `;
    }

    // Owner card indicator & quick toggle
    const ownerBadge = isOwner ? `
      <div class="absolute -top-2.5 left-4 bg-tertiary text-white font-label-sm text-label-sm px-2.5 py-0.5 rounded-full font-bold shadow-sm flex items-center gap-1">
        <span class="material-symbols-outlined text-[12px]">badge</span> You (Your Profile)
      </div>
    ` : '';

    const universalBadge = isOminus ? `
      <div class="absolute -top-2.5 right-4 bg-primary text-on-primary font-label-sm text-label-sm px-2.5 py-0.5 rounded-full font-bold shadow-sm">
        Universal Donor (O-)
      </div>
    ` : '';

    const donationsCompleted = donor.donationsCount ? `${donor.donationsCount} times completed` : 'Verified Volunteer';
    const distanceText = donor.distance || 'Local area';
    const safePhone = donor.phoneNumber || '+1 (555) 000-0000';
    const phoneClean = safePhone.replace(/[^0-9+]/g, '');

    return `
      <div class="donor-card bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col justify-between hover:shadow-xl transition-all relative ${isOwner ? 'is-current-user' : ''}">
        ${ownerBadge}
        ${universalBadge}
        
        <div class="flex flex-col pt-1">
          <!-- Card Header & Badge -->
          <div class="flex items-start justify-between gap-space-xs mb-space-sm">
            <div class="flex items-center gap-space-sm">
              <div class="w-12 h-12 rounded-xl ${bloodBoxClass} flex items-center justify-center font-headline-md text-headline-md font-bold shadow-inner shrink-0">
                ${donor.bloodGroup}
              </div>
              <div>
                <div class="flex items-center gap-1">
                  <h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold">${escapeHtml(donor.name)}</h3>
                  <span class="material-symbols-outlined text-tertiary-container text-[18px]" title="Clinical Verified Volunteer">verified</span>
                </div>
                <div class="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm">
                  <span class="material-symbols-outlined text-[16px]">location_on</span>
                  <span>${escapeHtml(donor.city)}</span>
                </div>
              </div>
            </div>
            ${statusChipHtml}
          </div>

          <!-- Metadata Grid -->
          <div class="grid grid-cols-2 gap-space-xs py-space-sm my-space-xs rounded-lg bg-surface-container-low px-space-sm">
            <div>
              <span class="block font-label-sm text-label-sm text-on-surface-variant">Donations</span>
              <span class="font-label-md text-label-md text-on-surface font-bold">${donationsCompleted}</span>
            </div>
            <div>
              <span class="block font-label-sm text-label-sm text-on-surface-variant">Radius</span>
              <span class="font-label-md text-label-md text-on-surface font-bold">${distanceText}</span>
            </div>
          </div>

          <!-- Direct Phone Display -->
          <div class="mt-space-xs mb-space-sm flex items-center justify-between p-2 rounded-lg bg-surface-container/60">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[18px]">call</span>
              <span class="font-label-lg text-label-lg text-on-surface font-mono font-bold">${escapeHtml(safePhone)}</span>
            </div>
            <span class="font-label-sm text-label-sm text-tertiary font-bold uppercase">Direct Phone</span>
          </div>

          <!-- If Owner: Show Quick Availability Switch Directly On Card -->
          ${isOwner ? `
            <div class="mb-space-sm p-2 rounded-lg bg-red-50/70 border border-red-100 flex items-center justify-between">
              <span class="font-label-sm text-label-sm text-on-surface font-semibold">Your Live Availability:</span>
              <label class="switch">
                <input type="checkbox" ${donor.isAvailable ? 'checked' : ''} onchange="window.toggleCurrentDonorAvailability(this.checked)">
                <span class="slider"></span>
              </label>
            </div>
          ` : ''}
        </div>

        <!-- Action CTA Buttons -->
        <div class="flex items-center gap-space-xs pt-space-xs">
          <a class="flex-1 h-10 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-1.5 hover:bg-primary-hover transition-colors shadow-sm" href="tel:${phoneClean}">
            <span class="material-symbols-outlined text-[18px]">phone_in_talk</span>
            <span>Contact Donor</span>
          </a>
          <button class="w-10 h-10 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors" 
                  onclick="window.openDonorDetails('${escapeHtml(donor.name)}', '${donor.bloodGroup}', '${escapeHtml(donor.city)}', '${escapeHtml(safePhone)}', '${donationsCompleted}')"
                  title="Quick Message / SMS">
            <span class="material-symbols-outlined text-[20px]">chat</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ==========================================================================
   Donor Availability Toggle (Firestore Update)
   ========================================================================== */
export async function toggleCurrentDonorAvailability(newAvailableState) {
  if (!state.currentUser) {
    showToast("Please sign in to update your donor status.", "error");
    openModal('authModal');
    return;
  }

  try {
    const userDocRef = doc(db, 'donors', state.currentUser.uid);
    await updateDoc(userDocRef, {
      isAvailable: newAvailableState,
      updatedAt: serverTimestamp()
    });

    if (state.currentDonorProfile) {
      state.currentDonorProfile.isAvailable = newAvailableState;
    }
    updateDonorProfileBadge();
    renderDonors();

    showToast(`Your status is now ${newAvailableState ? 'Available Now' : 'Temporarily Inactive'}.`, "success");
  } catch (error) {
    console.error("Error toggling donor availability:", error);
    showToast("Failed to update availability in Firestore. Please try again.", "error");
    // Revert visual switch
    updateDonorProfileBadge();
  }
}
window.toggleCurrentDonorAvailability = toggleCurrentDonorAvailability;

/* ==========================================================================
   Donor Profile Modal & Editing
   ========================================================================== */
export function openDonorProfileModal() {
  if (!state.currentUser) {
    openModal('authModal');
    return;
  }

  const modal = document.getElementById('profileModal');
  const emailDisplay = document.getElementById('profileEmailDisplay');
  const nameInput = document.getElementById('profileNameInput');
  const bloodInput = document.getElementById('profileBloodSelect');
  const cityInput = document.getElementById('profileCityInput');
  const phoneInput = document.getElementById('profilePhoneInput');
  const availToggle = document.getElementById('profileAvailToggle');

  if (emailDisplay) emailDisplay.textContent = state.currentUser.email;

  if (state.currentDonorProfile) {
    const p = state.currentDonorProfile;
    if (nameInput) nameInput.value = p.name || '';
    if (bloodInput) bloodInput.value = p.bloodGroup || 'O+';
    if (cityInput) cityInput.value = p.city || '';
    if (phoneInput) phoneInput.value = p.phoneNumber || '';
    if (availToggle) availToggle.checked = !!p.isAvailable;
  } else {
    // If logged in but not registered as donor yet, pre-fill and suggest registration
    if (nameInput) nameInput.value = '';
    if (cityInput) cityInput.value = 'New York, NY';
    if (availToggle) availToggle.checked = true;
  }

  openModal('profileModal');
}
window.openDonorProfileModal = openDonorProfileModal;

export async function handleSaveProfile(event) {
  event.preventDefault();
  if (!state.currentUser) return;

  const name = document.getElementById('profileNameInput').value.trim();
  const bloodGroup = document.getElementById('profileBloodSelect').value;
  const city = document.getElementById('profileCityInput').value.trim();
  const phoneNumber = document.getElementById('profilePhoneInput').value.trim();
  const isAvailable = document.getElementById('profileAvailToggle').checked;

  try {
    const userDocRef = doc(db, 'donors', state.currentUser.uid);
    const donorPayload = {
      name,
      bloodGroup,
      city,
      phoneNumber,
      isAvailable,
      userId: state.currentUser.uid,
      userEmail: state.currentUser.email,
      updatedAt: serverTimestamp()
    };

    if (!state.currentDonorProfile) {
      donorPayload.createdAt = serverTimestamp();
      donorPayload.donationsCount = 1;
      donorPayload.age = 25;
    }

    await setDoc(userDocRef, donorPayload, { merge: true });

    state.currentDonorProfile = {
      ...(state.currentDonorProfile || {}),
      ...donorPayload
    };

    updateDonorProfileBadge();
    renderDonors();
    closeModal('profileModal');
    showToast("Donor profile saved to Firestore!", "success");
  } catch (error) {
    console.error("Error saving donor profile:", error);
    showToast("Error saving profile: " + error.message, "error");
  }
}
window.handleSaveProfile = handleSaveProfile;

/* ==========================================================================
   Donor Registration Form Handler (Firestore 'donors' collection)
   ========================================================================== */
export async function handleRegistration(event) {
  event.preventDefault();

  const name = document.getElementById('regName').value.trim();
  const age = parseInt(document.getElementById('regAge').value, 10);
  const bloodGroup = document.getElementById('regBloodGroup').value;
  const city = document.getElementById('regCity').value.trim();
  const phoneNumber = document.getElementById('regPhone').value.trim();
  const isAvailable = document.getElementById('emergencyToggle').checked;
  const healthConsent = document.getElementById('healthConsent').checked;

  if (!healthConsent) {
    showToast("Please confirm the health checklist to proceed.", "error");
    return;
  }

  if (!state.currentUser) {
    // If not logged in, ask user to log in or create account first, save pending reg in memory
    sessionStorage.setItem('pendingDonorReg', JSON.stringify({
      name, age, bloodGroup, city, phoneNumber, isAvailable
    }));
    closeModal('registerModal');
    openModal('authModal');
    showToast("Please sign in or create an account to link your donor UID.", "info");
    return;
  }

  try {
    const userDocRef = doc(db, 'donors', state.currentUser.uid);
    const donorRecord = {
      name,
      age,
      bloodGroup,
      city,
      phoneNumber,
      isAvailable,
      userId: state.currentUser.uid,
      userEmail: state.currentUser.email,
      donationsCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(userDocRef, donorRecord);

    state.currentDonorProfile = { id: state.currentUser.uid, ...donorRecord };
    updateDonorProfileBadge();
    renderDonors();

    closeModal('registerModal');
    showToast("Donor profile registered successfully!", "success");
  } catch (error) {
    console.error("Firestore donor registration error:", error);
    showToast("Registration error: " + error.message, "error");
  }
}
window.handleRegistration = handleRegistration;

export function handleRegisterClick() {
  if (!state.currentUser) {
    openModal('authModal');
    showToast("Please sign in or register an account to register as a donor.", "info");
  } else {
    // If already registered, open profile
    if (state.currentDonorProfile) {
      openDonorProfileModal();
    } else {
      openModal('registerModal');
    }
  }
}
window.handleRegisterClick = handleRegisterClick;

/* ==========================================================================
   Authentication Form Handlers (Sign In & Sign Up)
   ========================================================================== */
export function switchAuthTab(tab) {
  const loginTab = document.getElementById('tabLoginBtn');
  const signupTab = document.getElementById('tabSignupBtn');
  const loginForm = document.getElementById('authLoginForm');
  const signupForm = document.getElementById('authSignupForm');
  const authTitle = document.getElementById('authModalTitle');

  if (tab === 'login') {
    loginTab.className = 'flex-1 py-1.5 text-center font-label-md text-label-md rounded-md bg-surface-container-lowest text-on-surface shadow-xs font-bold transition-all';
    signupTab.className = 'flex-1 py-1.5 text-center font-label-md text-label-md rounded-md text-on-surface-variant hover:text-on-surface transition-all';
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    if (authTitle) authTitle.textContent = "Welcome Back";
  } else {
    signupTab.className = 'flex-1 py-1.5 text-center font-label-md text-label-md rounded-md bg-surface-container-lowest text-on-surface shadow-xs font-bold transition-all';
    loginTab.className = 'flex-1 py-1.5 text-center font-label-md text-label-md rounded-md text-on-surface-variant hover:text-on-surface transition-all';
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    if (authTitle) authTitle.textContent = "Create Donor Account";
  }
}
window.switchAuthTab = switchAuthTab;

export async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmailInput').value.trim();
  const password = document.getElementById('loginPasswordInput').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeModal('authModal');
    showToast("Logged in successfully!", "success");

    // Check if there was a pending donor registration waiting
    checkPendingRegistration();
  } catch (error) {
    console.error("Login failed:", error);
    let message = error.message;
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      message = "Invalid email or password. Please try again.";
    } else if (error.code === 'auth/user-not-found') {
      message = "No account found with this email. Please sign up.";
    }
    showToast(message, "error");
  }
}
window.handleLogin = handleLogin;

export async function handleSignup(event) {
  event.preventDefault();
  const email = document.getElementById('signupEmailInput').value.trim();
  const password = document.getElementById('signupPasswordInput').value;
  const confirm = document.getElementById('signupConfirmPasswordInput').value;

  if (password !== confirm) {
    showToast("Passwords do not match.", "error");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.", "error");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    closeModal('authModal');
    showToast("Account created successfully!", "success");

    checkPendingRegistration();
  } catch (error) {
    console.error("Signup failed:", error);
    let message = error.message;
    if (error.code === 'auth/email-already-in-use') {
      message = "This email is already registered. Please sign in.";
    } else if (error.code === 'auth/weak-password') {
      message = "Password is too weak. Please use a stronger password.";
    }
    showToast(message, "error");
  }
}
window.handleSignup = handleSignup;

export async function handleLogout() {
  try {
    await signOut(auth);
    showToast("Signed out successfully.", "info");
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Error signing out: " + error.message, "error");
  }
}
window.handleLogout = handleLogout;

async function checkPendingRegistration() {
  const pending = sessionStorage.getItem('pendingDonorReg');
  if (pending && state.currentUser) {
    try {
      const data = JSON.parse(pending);
      sessionStorage.removeItem('pendingDonorReg');
      const userDocRef = doc(db, 'donors', state.currentUser.uid);
      await setDoc(userDocRef, {
        ...data,
        userId: state.currentUser.uid,
        userEmail: state.currentUser.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("Linked your profile as a registered donor!", "success");
    } catch (e) {
      console.warn("Could not process pending reg:", e);
    }
  }
}

/* ==========================================================================
   Password Visibility Toggle
   ========================================================================== */
export function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

/* ==========================================================================
   Contact Modal Launcher
   ========================================================================== */
export function openDonorDetails(name, bloodGroup, loc, phone, stats) {
  const nameEl = document.getElementById('detailDonorName');
  const bloodEl = document.getElementById('detailBloodGroup');
  const locEl = document.getElementById('detailDonorLoc');
  const statsEl = document.getElementById('detailDonorStats');
  const callLink = document.getElementById('detailCallLink');
  const smsLink = document.getElementById('detailSmsLink');

  if (nameEl) nameEl.textContent = name;
  if (bloodEl) bloodEl.textContent = bloodGroup;
  if (locEl) locEl.textContent = loc;
  if (statsEl) statsEl.textContent = stats;

  const cleanNum = phone.replace(/[^0-9+]/g, '');
  if (callLink) callLink.setAttribute('href', `tel:${cleanNum}`);
  if (smsLink) smsLink.setAttribute('href', `sms:${cleanNum}`);

  openModal('contactModal');
}
window.openDonorDetails = openDonorDetails;

/* ==========================================================================
   Initial Boot Setup
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Modal overlay click listeners
  const modalIds = ['registerModal', 'authModal', 'contactModal', 'profileModal', 'bloodBanksModal', 'emergencyModal'];
  modalIds.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(id);
        }
      });
    }
  });

  // ESC key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modalIds.forEach(id => closeModal(id));
    }
  });

  // Urgency pill listeners
  const pills = document.querySelectorAll('.urgency-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      setUrgencyFilter(pill.dataset.urgency || 'all');
    });
  });

  // Initial render
  renderDonors();
});
