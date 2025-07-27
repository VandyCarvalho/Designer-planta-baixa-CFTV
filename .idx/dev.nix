{pkgs}: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
    pkgs.gtk3
    pkgs.nss
    pkgs.gconf
    pkgs.alsa-lib
    pkgs.libx11
    pkgs.libxss
    pkgs.libxtst
    pkgs.libappindicator-gtk3
  ];
  idx.extensions = [
    "svelte.svelte-vscode"
    "vue.volar"
  ];
  idx.previews = {
    previews = {
      web = {
        command = [
          "npm"
          "run"
          "dev"
          "--"
          "--port"
          "$PORT"
          "--host"
          "0.0.0.0"
        ];
        manager = "web";
      };
    };
  };
}
