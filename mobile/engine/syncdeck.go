// Package syncdeckengine is the gomobile entry point for the SyncDeck phone app.
//
// It exists to keep the binary small. rclone's own librclone/gomobile package
// pulls in backend/all, which links every one of the ~70 backends and produced a
// 476 MB xcframework. librclone itself does NOT import backend/all, so binding
// this package instead, with only the backends SyncDeck actually offers, lets
// the linker drop the rest.
//
// To support another provider, add its blank import below and rebuild. The list
// must stay in sync with the client wizard in the desktop app.
package syncdeckengine

import (
	"github.com/rclone/rclone/librclone/librclone"

	// Curated backends. Keep alphabetical.
	_ "github.com/rclone/rclone/backend/b2"
	_ "github.com/rclone/rclone/backend/box"
	_ "github.com/rclone/rclone/backend/crypt"
	_ "github.com/rclone/rclone/backend/drive"
	_ "github.com/rclone/rclone/backend/dropbox"
	_ "github.com/rclone/rclone/backend/ftp"
	_ "github.com/rclone/rclone/backend/local"
	_ "github.com/rclone/rclone/backend/onedrive"
	_ "github.com/rclone/rclone/backend/pcloud"
	_ "github.com/rclone/rclone/backend/protondrive"
	_ "github.com/rclone/rclone/backend/s3"
	_ "github.com/rclone/rclone/backend/sftp"
	_ "github.com/rclone/rclone/backend/smb"
	_ "github.com/rclone/rclone/backend/webdav"
)

// RPCResult carries the librclone response. gomobile cannot bind multiple
// return values, so the pair is wrapped in a struct.
type RPCResult struct {
	Output string
	Status int
}

// Initialize starts the engine. Call once before any RPC.
func Initialize() {
	librclone.Initialize()
}

// RPC runs an rclone remote-control method with a JSON input string and returns
// the JSON output plus an HTTP-style status code.
func RPC(method string, input string) *RPCResult {
	output, status := librclone.RPC(method, input)
	return &RPCResult{Output: output, Status: status}
}

// Finalize shuts the engine down and releases resources.
func Finalize() {
	librclone.Finalize()
}
