document.addEventListener("DOMContentLoaded", () => {
  let timerInterval = null;

  // Función principal para cambiar de paso
  function goToScreen(num) {
    document.querySelectorAll('.screen').forEach(s => s.hidden = true);
    const target = document.querySelector(`.screen[data-screen="${num}"]`);
    if (target) target.hidden = false;
  }

  // --- PASO 1 ---
  const tgIdInput = document.getElementById('tgId');
  const btnSend = document.getElementById('btnSend');
  const btnVerify = document.getElementById('btnVerify');
  const tgIdShow = document.getElementById('tgIdShow');

  tgIdInput.addEventListener('input', () => {
    const val = tgIdInput.value.trim();
    btnVerify.disabled = val.length < 5;
  });

  function processPaso1() {
    const val = tgIdInput.value.trim();
    if (val.length >= 5) {
      tgIdShow.value = val;
      goToScreen(2);
    }
  }

  btnSend.addEventListener('click', processPaso1);
  btnVerify.addEventListener('click', processPaso1);

  // --- LÓGICA REUTILIZABLE PARA OTP (Paso 2 y Paso 4) ---
  function setupOtpContainer(containerId, btnToEnable) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const inputs = container.querySelectorAll('input');

    inputs.forEach((input, index) => {
      input.addEventListener('input', () => {
        if (input.value && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
        checkStatus();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          inputs[index - 1].focus();
        }
      });
    });

    function checkStatus() {
      const isFilled = Array.from(inputs).every(i => i.value.trim().length > 0);
      btnToEnable.disabled = !isFilled;
    }
  }

  // --- PASO 2 ---
  const btnLogin = document.getElementById('btnLogin');
  setupOtpContainer('otpLogin', btnLogin);
  btnLogin.addEventListener('click', () => goToScreen(3));

  // --- PASO 3 ---
  let selectedPlatform = null;
  const btnPlat = document.getElementById('btnPlat');
  
  document.querySelectorAll('.plat').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.plat').forEach(p => p.classList.remove('sel'));
      item.classList.add('sel');
      selectedPlatform = item.getAttribute('data-id');
      btnPlat.disabled = false;
    });
  });

  btnPlat.addEventListener('click', () => {
    if (selectedPlatform) goToScreen(4);
  });

  // --- PASO 4 ---
  const btnActivate = document.getElementById('btnActivate');
  setupOtpContainer('otpTv', btnActivate);

  btnActivate.addEventListener('click', () => {
    goToScreen(5);
    startCountdown();
  });

  // --- PASO 5 ---
  function startCountdown() {
    let count = 8;
    const cdEl = document.getElementById('countdown');
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      count--;
      if (cdEl) cdEl.textContent = count;
      if (count <= 0) {
        clearInterval(timerInterval);
      }
    }, 1000);
  }

  // Botón Reiniciar
  document.getElementById('btnAgain').addEventListener('click', () => {
    tgIdInput.value = '';
    btnVerify.disabled = true;
    btnPlat.disabled = true;
    btnLogin.disabled = true;
    btnActivate.disabled = true;
    
    document.querySelectorAll('.otp input').forEach(i => i.value = '');
    document.querySelectorAll('.plat').forEach(p => p.classList.remove('sel'));

    if (timerInterval) clearInterval(timerInterval);
    goToScreen(1);
  });
});
