.PHONY: default

lint:
	cargo clippy 
fmt:
	cargo fmt --all --
dev:
	cargo run