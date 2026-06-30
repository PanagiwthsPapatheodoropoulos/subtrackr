package app.subtrackr.config;

import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.hibernate.generator.internal.CurrentTimestampGeneration;

public class NativeRuntimeHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        hints.reflection().registerType(CurrentTimestampGeneration.class,
                builder -> builder.withConstructor(java.util.Collections.emptyList(), org.springframework.aot.hint.ExecutableMode.INVOKE));
    }
}
