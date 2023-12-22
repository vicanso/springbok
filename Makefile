.PHONY: default macos

lint:
	cargo clippy 
fmt:
	cargo fmt --all --
dev:
	cargo run
release:
	cargo build --release
macos:
	mv ./target/release/springbok ./macos/Contents/MacOS/
	mv ./macos ./Springbok.app

udeps:
	cargo +nightly udeps

# 如果要使用需注释 profile.release 中的 strip
bloat:
	cargo bloat --release --crates