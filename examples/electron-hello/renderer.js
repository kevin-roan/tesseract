const { platform, arch, versions } = window.runtime;

document.getElementById("platform").textContent = `${platform} (${arch})`;
document.getElementById("electron").textContent = versions.electron;
document.getElementById("chrome").textContent = versions.chrome;
document.getElementById("node").textContent = versions.node;
