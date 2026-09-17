package compose

import "testing"

func TestAttachIgnoresNil(t *testing.T) {
	before := len(attachers)
	Attach(nil)
	if len(attachers) != before {
		t.Fatal("nil attacher must not register")
	}
}
