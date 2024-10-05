.PHONY: default macos

lint:
	cd src-tauri
	cargo clippy
fmt:
	cd src-tauri
	cargo fmt --all --
dev:
	npm run tauri dev
dev-web:
	npm run dev

icon:
	cargo tauri icon ./springbok.png

release:
	cargo tauri build --no-bundle
bundles:
	cargo tauri build --bundles app,dmg
