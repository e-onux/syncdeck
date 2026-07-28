module github.com/e-onux/syncdeck/mobile/engine

go 1.23

// The rclone version is pinned by CI from app/rclone.version, so this file
// deliberately carries no require block: the workflow runs
//   go get github.com/rclone/rclone@v<version> && go mod tidy
// before binding, which keeps the mobile engine and the desktop engine on the
// exact same rclone release.
